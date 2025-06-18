"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useWindowSize } from "usehooks-ts";
import Image from "next/image";
import { useAtom } from "jotai/react";
import { contextIdAtom } from "../atoms";
import posthog from "posthog-js";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Loader2, X, Globe, Check, AlertCircle, Navigation, FileText, Eye, Brain, Sparkles, ExternalLink } from "lucide-react";

interface ChatFeedProps {
  initialMessage?: string;
  onClose: () => void;
  url?: string;
}

export interface BrowserStep {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK";
  instruction: string;
  stepNumber?: number;
}

interface AgentState {
  sessionId: string | null;
  sessionUrl: string | null;
  steps: BrowserStep[];
  isLoading: boolean;
}

export default function ChatFeed({ initialMessage, onClose }: ChatFeedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const initializationRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAgentFinished, setIsAgentFinished] = useState(false);
  const [contextId, setContextId] = useAtom(contextIdAtom);
  const agentStateRef = useRef<AgentState>({
    sessionId: null,
    sessionUrl: null,
    steps: [],
    isLoading: false,
  });

  const [uiState, setUiState] = useState<{
    sessionId: string | null;
    sessionUrl: string | null;
    steps: BrowserStep[];
  }>({
    sessionId: null,
    sessionUrl: null,
    steps: [],
  });

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (
      uiState.steps.length > 0 &&
      uiState.steps[uiState.steps.length - 1].tool === "CLOSE"
    ) {
      setIsAgentFinished(true);
      fetch("/api/session", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: uiState.sessionId,
        }),
      });
    }
  }, [uiState.sessionId, uiState.steps]);

  useEffect(() => {
    scrollToBottom();
  }, [uiState.steps, scrollToBottom]);

  useEffect(() => {
    console.log("useEffect called");
    const initializeSession = async () => {
      if (initializationRef.current) return;
      initializationRef.current = true;

      if (initialMessage && !agentStateRef.current.sessionId) {
        setIsLoading(true);
        try {
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

          agentStateRef.current = {
            ...agentStateRef.current,
            sessionId: sessionData.sessionId,
            sessionUrl: sessionData.sessionUrl.replace(
              "https://www.browserbase.com/devtools-fullscreen/inspector.html",
              "https://www.browserbase.com/devtools-internal-compiled/index.html"
            ),
          };

          setUiState({
            sessionId: sessionData.sessionId,
            sessionUrl: sessionData.sessionUrl.replace(
              "https://www.browserbase.com/devtools-fullscreen/inspector.html",
              "https://www.browserbase.com/devtools-internal-compiled/index.html"
            ),
            steps: [],
          });

          const response = await fetch("/api/agent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              goal: initialMessage,
              sessionId: sessionData.sessionId,
              action: "START",
            }),
          });

          const data = await response.json();
          posthog.capture("agent_start", {
            goal: initialMessage,
            sessionId: sessionData.sessionId,
            contextId: sessionData.contextId,
          });

          if (data.success) {
            const newStep = {
              text: data.result.text,
              reasoning: data.result.reasoning,
              tool: data.result.tool,
              instruction: data.result.instruction,
              stepNumber: 1,
            };

            agentStateRef.current = {
              ...agentStateRef.current,
              steps: [newStep],
            };

            setUiState((prev) => ({
              ...prev,
              steps: [newStep],
            }));

            // Continue with subsequent steps
            while (true) {
              // Get next step from LLM
              const nextStepResponse = await fetch("/api/agent", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  goal: initialMessage,
                  sessionId: sessionData.sessionId,
                  previousSteps: agentStateRef.current.steps,
                  action: "GET_NEXT_STEP",
                }),
              });

              const nextStepData = await nextStepResponse.json();

              if (!nextStepData.success) {
                throw new Error("Failed to get next step");
              }

              // Add the next step to UI immediately after receiving it
              const nextStep = {
                ...nextStepData.result,
                stepNumber: agentStateRef.current.steps.length + 1,
              };

              agentStateRef.current = {
                ...agentStateRef.current,
                steps: [...agentStateRef.current.steps, nextStep],
              };

              setUiState((prev) => ({
                ...prev,
                steps: agentStateRef.current.steps,
              }));

              // Break after adding the CLOSE step to UI
              if (nextStepData.done || nextStepData.result.tool === "CLOSE") {
                break;
              }

              // Execute the step
              const executeResponse = await fetch("/api/agent", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  sessionId: sessionData.sessionId,
                  step: nextStepData.result,
                  action: "EXECUTE_STEP",
                }),
              });

              const executeData = await executeResponse.json();

              posthog.capture("agent_execute_step", {
                goal: initialMessage,
                sessionId: sessionData.sessionId,
                contextId: sessionData.contextId,
                step: nextStepData.result,
              });

              if (!executeData.success) {
                throw new Error("Failed to execute step");
              }

              if (executeData.done) {
                break;
              }
            }
          }
        } catch (error) {
          console.error("Session initialization error:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    initializeSession();
  }, [initialMessage]);

  // Spring configuration for smoother animations
  const springConfig = {
    type: "spring",
    stiffness: 350,
    damping: 30,
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        ...springConfig,
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return <Navigation className="w-3 h-3" />;
      case "ACT":
        return <Globe className="w-3 h-3" />;
      case "EXTRACT":
        return <FileText className="w-3 h-3" />;
      case "OBSERVE":
        return <Eye className="w-3 h-3" />;
      case "CLOSE":
        return <Check className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getToolVariant = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return "default";
      case "ACT":
        return "secondary";
      case "EXTRACT":
        return "outline";
      case "OBSERVE":
        return "outline";
      case "CLOSE":
        return "default";
      default:
        return "secondary";
    }
  };

  const getToolColor = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return "from-blue-500/20 to-purple-500/20";
      case "ACT":
        return "from-green-500/20 to-emerald-500/20";
      case "EXTRACT":
        return "from-yellow-500/20 to-orange-500/20";
      case "OBSERVE":
        return "from-purple-500/20 to-pink-500/20";
      case "CLOSE":
        return "from-green-500/20 to-teal-500/20";
      default:
        return "from-gray-500/20 to-zinc-500/20";
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-black flex flex-col relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-radial from-orange-900/10 via-black to-black" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%239C92AC&quot; fill-opacity=&quot;0.03&quot;%3E%3Cpath d=&quot;M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
      
      <motion.nav
        className="relative z-50 flex justify-between items-center px-8 py-6 border-b border-zinc-800/50 backdrop-blur-xl bg-black/50"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ rotate: -180, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-50" />
            <Image
              src="/favicon.svg"
              alt="オープンオペレーター"
              className="w-10 h-10 relative z-10"
              width={40}
              height={40}
            />
          </motion.div>
          <div>
            <h1 className="font-ppneue text-white text-xl">オープンオペレーター</h1>
            <p className="text-xs text-zinc-500 font-ppsupply">セッション実行中</p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          className="gap-2 text-zinc-400 hover:text-white"
        >
          <X className="w-4 h-4" />
          閉じる
          {!isMobile && (
            <kbd className="px-2 py-1 text-xs bg-zinc-900 rounded-md border border-zinc-800">ESC</kbd>
          )}
        </Button>
      </motion.nav>
      
      <main className="flex-1 flex flex-col items-center p-6 relative z-10">
        <motion.div
          className="w-full max-w-[1400px]"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-dark border-zinc-800/50 shadow-2xl overflow-hidden">
            <div className="w-full h-10 bg-zinc-900/50 border-b border-zinc-800/50 flex items-center px-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-all" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-all" />
                <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-all" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Brain className="w-3 h-3 text-primary animate-pulse" />
                <span className="text-xs text-zinc-500 font-ppsupply">AI Browser Session</span>
              </div>
            </div>

            {(() => {
              console.log("Session URL:", uiState.sessionUrl);
              return null;
            })()}

            <div className="flex flex-col lg:flex-row">
              {/* Browser View */}
              <div className="flex-1 bg-zinc-950">
                {uiState.sessionUrl && !isAgentFinished && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-6"
                  >
                    <div className="rounded-lg overflow-hidden shadow-2xl border border-zinc-800/50">
                      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-zinc-500" />
                        <span className="text-xs text-zinc-500 font-mono">browser.session</span>
                        <ExternalLink className="w-3 h-3 text-zinc-600 ml-auto" />
                      </div>
                      <div className="aspect-video bg-black">
                        <iframe
                          src={uiState.sessionUrl}
                          className="w-full h-full"
                          sandbox="allow-same-origin allow-scripts allow-forms"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          title="Browser Session"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {isAgentFinished && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="p-6 h-full flex items-center justify-center min-h-[500px]"
                  >
                    <Card className="bg-zinc-900/50 border-zinc-800 max-w-md w-full">
                      <CardContent className="p-8 text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Check className="w-10 h-10 text-green-500" />
                        </div>
                        <h3 className="text-xl font-ppneue text-white mb-2">
                          タスク完了
                        </h3>
                        <p className="text-zinc-400 font-ppsupply">
                          エージェントが正常に実行されました
                        </p>
                        <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                          <p className="text-sm text-zinc-500 italic">
                            &quot;{initialMessage}&quot;
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </div>

              {/* Steps Panel */}
              <div className="lg:w-[450px] border-t lg:border-t-0 lg:border-l border-zinc-800/50 bg-zinc-900/30">
                <div className="p-6 h-full">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-ppneue text-white">実行ステップ</h2>
                  </div>
                  
                  <div
                    ref={chatContainerRef}
                    className="h-[calc(100vh-250px)] overflow-y-auto space-y-4 pr-2"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#3f3f46 #18181b'
                    }}
                  >
                    {initialMessage && (
                      <motion.div variants={messageVariants}>
                        <Card className="bg-gradient-to-br from-primary/10 to-orange-600/10 border-primary/20">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                                <Brain className="w-4 h-4 text-white" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-white text-sm">タスク</p>
                                <p className="text-zinc-300 mt-1 text-sm">{initialMessage}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}

                    {uiState.steps.map((step, index) => (
                      <motion.div
                        key={index}
                        variants={messageVariants}
                        className="relative"
                      >
                        {index > 0 && (
                          <div className="absolute left-4 -top-4 w-0.5 h-4 bg-zinc-800" />
                        )}
                        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all group">
                          <CardContent className="p-4">
                            <div className={`absolute inset-0 bg-gradient-to-br ${getToolColor(step.tool)} opacity-0 group-hover:opacity-100 transition-opacity rounded-xl`} />
                            <div className="relative">
                              <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                                    <span className="text-xs font-bold text-zinc-400">
                                      {step.stepNumber}
                                    </span>
                                  </div>
                                  <Badge 
                                    variant={getToolVariant(step.tool) as any}
                                    className="gap-1"
                                  >
                                    {getToolIcon(step.tool)}
                                    {step.tool}
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="space-y-3 pl-10">
                                <p className="text-sm text-white font-medium">{step.text}</p>
                                <div className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800">
                                  <div className="flex items-start gap-2">
                                    <AlertCircle className="w-3 h-3 text-zinc-500 mt-0.5" />
                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                      {step.reasoning}
                                    </p>
                                  </div>
                                </div>
                                {step.instruction && (
                                  <div className="text-xs text-zinc-600 font-mono bg-zinc-900/50 px-2 py-1 rounded">
                                    {step.instruction}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                    
                    {isLoading && (
                      <motion.div variants={messageVariants}>
                        <Card className="bg-zinc-900/50 border-zinc-800">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                <div className="absolute inset-0 bg-primary blur-xl opacity-50" />
                              </div>
                              <span className="text-zinc-400 font-ppsupply">処理中...</span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </main>
    </motion.div>
  );
}
