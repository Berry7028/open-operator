"use client";

import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ChatSession, Message, BrowserStep } from "../../types";
import { useAtom } from "jotai/react";
import { contextIdAtom } from "../../atoms";

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

  useEffect(() => {
    if (session.messages.length > 0 && !initializationRef.current) {
      initializationRef.current = true;
      startBrowserSession();
    }
  }, [session.messages]);

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
        id: Date.now().toString(),
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
            id: Date.now().toString(),
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
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-4 rounded-lg font-ppsupply ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.metadata && (
                    <div className="text-xs opacity-70 mt-2">
                      Model: {message.metadata.model}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Agent Steps */}
            {agentState.steps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4"
              >
                <h4 className="font-ppneue text-gray-900 mb-4">Agent Execution Steps</h4>
                <div className="space-y-3">
                  {agentState.steps.map((step, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-500 font-ppsupply">
                          Step {step.stepNumber}
                        </span>
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-ppsupply">
                          {step.tool}
                        </span>
                      </div>
                      <p className="font-medium font-ppsupply">{step.text}</p>
                      <p className="text-sm text-gray-600 font-ppsupply">
                        <span className="font-semibold">Reasoning: </span>
                        {step.reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-white border border-gray-200 rounded-lg p-4 font-ppsupply">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span>Processing your request...</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Browser View */}
      {agentState.sessionUrl && (
        <div className="w-1/2 border-l border-gray-200 bg-white">
          <div className="h-full flex flex-col">
            {/* Browser Chrome */}
            <div className="bg-gray-100 border-b border-gray-200 p-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-1 text-gray-500 hover:text-gray-700">←</button>
                <button className="p-1 text-gray-500 hover:text-gray-700">→</button>
                <button className="p-1 text-gray-500 hover:text-gray-700">↻</button>
                <div className="flex-1 px-3 py-1 bg-white border border-gray-300 rounded text-sm text-gray-600">
                  Browser Session
                </div>
              </div>
            </div>

            {/* Browser Content */}
            <div className="flex-1">
              {isAgentFinished ? (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-ppsupply">Task completed successfully!</p>
                  </div>
                </div>
              ) : (
                <iframe
                  src={agentState.sessionUrl}
                  className="w-full h-full border-none"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  title="Browser Session"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}