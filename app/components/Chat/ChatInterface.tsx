"use client";

import { useState, useRef, useEffect } from "react";
import { ChatSession, Message, BrowserStep } from "../../types";
import { useAtom } from "jotai/react";
import { contextIdAtom } from "../../atoms";
import { MessageBubble } from "@/components/chat/message-bubble";
import { AgentSteps } from "@/components/chat/agent-steps";
import { BrowserView } from "@/components/chat/browser-view";
import { Loader2 } from "lucide-react";

interface ChatInterfaceProps {
  session: ChatSession;
  onUpdateSession: (sessionId: string, updates: Partial<ChatSession>) => void;
  onAddMessage: (sessionId: string, message: Message) => void;
}

interface AgentState {
  sessionId: string | null;
  sessionUrl: string | null;
  steps: BrowserStep[];
  isLoading: boolean;
}

export default function ChatInterface({
  session,
  onUpdateSession,
  onAddMessage,
}: ChatInterfaceProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAgentFinished, setIsAgentFinished] = useState(false);
  const [contextId, setContextId] = useAtom(contextIdAtom);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);

  const [agentState, setAgentState] = useState<AgentState>({
    sessionId: null,
    sessionUrl: null,
    steps: [],
    isLoading: false,
  });

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [session.messages, agentState.steps]);

  // Reset initialization when session changes
  useEffect(() => {
    initializationRef.current = false;
    setIsLoading(false);
    setIsAgentFinished(false);
    setAgentState({
      sessionId: null,
      sessionUrl: null,
      steps: [],
      isLoading: false,
    });
  }, [session.id]);

  useEffect(() => {
    console.log("ChatInterface: Messages changed, length:", session.messages.length, "initialized:", initializationRef.current);
    if (session.messages.length > 0 && !initializationRef.current) {
      console.log("ChatInterface: Starting browser session");
      initializationRef.current = true;
      startBrowserSession();
    }
  }, [session.messages, session.id]); // Add session.id as dependency

  const startBrowserSession = async () => {
    const lastUserMessage = session.messages
      .filter(msg => msg.role === 'user')
      .pop();

    if (!lastUserMessage) return;

    setIsLoading(true);
    try {
      // Create browser session
      const sessionResponse = await fetch("/api/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          contextId: contextId,
        }),
      });

      const sessionData = await sessionResponse.json();
      if (!sessionData.success) {
        throw new Error(sessionData.error || "Failed to create session");
      }

      // Show mock mode warning if applicable
      if (sessionData.mock) {
        console.warn("Running in mock mode - Browserbase not configured");
        const warningMessage: Message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: "⚠️ Running in demo mode. To use full browser automation features, please configure Browserbase API keys in settings.",
          role: "assistant",
          timestamp: new Date(),
        };
        onAddMessage(session.id, warningMessage);
      }

      setContextId(sessionData.contextId);

      const newAgentState = {
        sessionId: sessionData.sessionId,
        sessionUrl: sessionData.sessionUrl.replace(
          "https://www.browserbase.com/devtools-fullscreen/inspector.html",
          "https://www.browserbase.com/devtools-internal-compiled/index.html"
        ),
        steps: [],
        isLoading: false,
      };

      setAgentState(newAgentState);

      // Start agent execution
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: lastUserMessage.content,
          sessionId: sessionData.sessionId,
          modelId: session.model,
          selectedTools: session.selectedTools || [],
          action: "START",
        }),
      });

      const data = await response.json();
      if (data.success) {
        const firstStep = {
          text: data.result.text,
          reasoning: data.result.reasoning,
          tool: data.result.tool,
          instruction: data.result.instruction,
          stepNumber: 1,
        };

        setAgentState(prev => ({
          ...prev,
          steps: [firstStep],
        }));

        // Continue with agent loop
        await continueAgentExecution(sessionData.sessionId, lastUserMessage.content, [firstStep]);
      }
    } catch (error) {
      console.error("Browser session error:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: "Sorry, I encountered an error while trying to help you. Please try again.",
        role: "assistant",
        timestamp: new Date(),
      };
      onAddMessage(session.id, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const continueAgentExecution = async (sessionId: string, goal: string, currentSteps: BrowserStep[]) => {
    let steps = [...currentSteps];

    while (true) {
      try {
        // Get next step from LLM
        const nextStepResponse = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            goal,
            sessionId,
            previousSteps: steps,
            modelId: session.model,
            selectedTools: session.selectedTools || [],
            action: "GET_NEXT_STEP",
          }),
        });

        const nextStepData = await nextStepResponse.json();
        if (!nextStepData.success) break;

        const nextStep = {
          ...nextStepData.result,
          stepNumber: steps.length + 1,
        };

        steps = [...steps, nextStep];
        setAgentState(prev => ({
          ...prev,
          steps,
        }));

        if (nextStepData.done || nextStepData.result.tool === "CLOSE") {
          setIsAgentFinished(true);
          
          // Add completion message
          const completionMessage: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: `Task completed! I've successfully executed ${steps.length} steps to help you with: "${goal}"`,
            role: "assistant",
            timestamp: new Date(),
            metadata: {
              model: session.model,
            },
          };
          onAddMessage(session.id, completionMessage);
          break;
        }

        // Execute the step
        const executeResponse = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            step: nextStepData.result,
            action: "EXECUTE_STEP",
          }),
        });

        const executeData = await executeResponse.json();
        
        // Handle tool results
        if (nextStep.tool === "CALL_TOOL" && executeData.extraction) {
          nextStep.toolResult = executeData.extraction;
          
          // Update the step with tool result
          setAgentState(prev => ({
            ...prev,
            steps: prev.steps.map(step => 
              step.stepNumber === nextStep.stepNumber 
                ? { ...step, toolResult: executeData.extraction }
                : step
            ),
          }));
        }

        if (!executeData.success || executeData.done) break;

      } catch (error) {
        console.error("Agent execution error:", error);
        break;
      }
    }
  };

  return (
    <div className="flex-1 flex">
      {/* Chat Messages */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6" ref={chatContainerRef}>
          <div className="max-w-4xl mx-auto space-y-6">
            {session.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            <AgentSteps steps={agentState.steps} />

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-lg p-4 font-ppsupply">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing your request...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BrowserView 
        sessionUrl={agentState.sessionUrl} 
        isFinished={isAgentFinished} 
      />
    </div>
  );
}