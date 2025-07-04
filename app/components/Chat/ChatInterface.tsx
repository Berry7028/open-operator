"use client";

import { useState, useRef, useEffect } from "react";
import { ChatSession, Message, BrowserStep } from "../../types";
import { useAtom } from "jotai/react";
import { contextIdAtom } from "../../atoms";
import { MessageBubble } from "@/components/chat/message-bubble";
import { AgentSteps } from "@/components/chat/agent-steps";
import { SidePanel } from "@/components/chat/side-panel";
import { Loader2 } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { getLanguageText } from "../../constants/languages";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onUpdateSession,
  onAddMessage,
}: ChatInterfaceProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isAgentFinished, setIsAgentFinished] = useState(false);
  const [contextId, setContextId] = useAtom(contextIdAtom);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const initializationRef = useRef(false);
  const { settings } = useSettings();
  const currentLanguage = settings.language || 'ja';
  const t = (key: string) => getLanguageText(currentLanguage, key);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          content: t('demoModeWarning'),
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
          language: settings.language || 'ja',
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
        content: t('errorOccurred'),
        role: "assistant",
        timestamp: new Date(),
      };
      onAddMessage(session.id, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const continueAgentExecution = async (sessionId: string, goal: string, currentSteps: BrowserStep[]) => {
    // 直前ステップのツール実行結果 → 次の LLM プロンプトへ
    let steps = [...currentSteps];
    let lastExtraction: Record<string, unknown> | null = null;

    // ループ安全策
    let lastToolName: string | null = null;
    let sameToolCount = 0;
    const MAX_SAME_TOOL_COUNT = 3;
    const MAX_TOTAL_STEPS = 25;

    while (true) {
      // 上限チェック
      if (steps.length >= MAX_TOTAL_STEPS) {
        const warnMsg: Message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: t('loopLimitWarning') || 'Loop limit reached. Stopping execution.',
          role: 'assistant',
          timestamp: new Date(),
        };
        onAddMessage(session.id, warnMsg);
        break;
      }

      try {
        // Get next step from LLM
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nextStepResponse: any = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            goal,
            sessionId,
            previousSteps: steps,
            previousExtraction: lastExtraction, // ★ 直前のツール実行結果を渡す
            modelId: session.model,
            selectedTools: session.selectedTools || [],
            action: "GET_NEXT_STEP",
            language: settings.language || 'ja',
          }),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nextStepData: any = await nextStepResponse.json();
        if (!nextStepData.success) break;

        const nextStep = {
          ...nextStepData.result,
          stepNumber: steps.length + 1,
        };

        // ループ検出: 警告を出すが処理は継続（AIプロンプト側で対処）
        if (lastToolName === nextStep.tool) {
          sameToolCount += 1;
          
          // 3回目で警告メッセージを表示（但し処理は継続）
          if (sameToolCount === MAX_SAME_TOOL_COUNT) {
            const warnMsg: Message = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              content: t('loopDetected') || '同じツールが繰り返し使用されています。AIが自動的に調整します...',
              role: 'assistant',
              timestamp: new Date(),
            };
            onAddMessage(session.id, warnMsg);
          }
        } else {
          sameToolCount = 1;
          lastToolName = nextStep.tool;
        }

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
            content: `${t('taskCompleted')} ${t('taskCompletedDesc').replace('{steps}', steps.length.toString()).replace('{goal}', goal)}`,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const executeResponse: any = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            step: nextStepData.result,
            selectedTools: session.selectedTools || [],
            action: "EXECUTE_STEP",
            language: settings.language || 'ja',
          }),
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const executeData: any = await executeResponse.json();
        
        // Handle tool results
        if (executeData.extraction) {
          nextStep.toolResult = executeData.extraction;

          // 次のループ用に結果を保存
          lastExtraction = executeData.extraction;

          // AI が生成した自然文があればチャットへ追加
          if (executeData.extraction.aiResponse) {
            const aiMessage: Message = {
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              content: executeData.extraction.aiResponse,
              role: "assistant",
              timestamp: new Date(),
            };
            onAddMessage(session.id, aiMessage);
          }

          // Update the step in state with tool result
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

            {/* ステップ詳細はデフォルトでは非表示にし、ユーザーがクリックで展開 */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-muted-foreground text-sm cursor-pointer select-none">
                <ChevronRight className="h-4 w-4" />
                <span className="font-ppsupply">詳細ステップを表示</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <AgentSteps steps={agentState.steps} />
              </CollapsibleContent>
            </Collapsible>

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-lg p-4 font-ppsupply">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('processingRequest')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SidePanel
        sessionUrl={agentState.sessionUrl}
        isFinished={isAgentFinished}
        steps={agentState.steps}
      />
    </div>
  );
}