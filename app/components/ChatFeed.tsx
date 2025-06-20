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
import { Input } from "./ui/input";
import { 
  Loader2, 
  X, 
  Globe, 
  Check, 
  AlertCircle, 
  Navigation, 
  FileText, 
  Eye, 
  Brain, 
  Sparkles, 
  ExternalLink, 
  Send, 
  User, 
  Bot, 
  Plus 
} from "./icons";

interface ChatFeedProps {
  initialMessage?: string;
  onClose: () => void;
  url?: string;
  sessionId?: string | null;
}

export interface BrowserStep {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK";
  instruction: string;
  stepNumber?: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  steps?: BrowserStep[];
}

interface AgentState {
  sessionId: string | null;
  sessionUrl: string | null;
  steps: BrowserStep[];
  isLoading: boolean;
}

export default function ChatFeed({ initialMessage, onClose, sessionId }: ChatFeedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const initializationRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAgentFinished, setIsAgentFinished] = useState(false);
  const [contextId, setContextId] = useAtom(contextIdAtom);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
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
    if (initialMessage) {
      setMessages([{
        id: Date.now().toString(),
        type: 'user',
        content: initialMessage,
        timestamp: new Date()
      }]);
    }
  }, [initialMessage]);

  useEffect(() => {
    if (
      uiState.steps.length > 0 &&
      uiState.steps[uiState.steps.length - 1].tool === "CLOSE"
    ) {
      setIsAgentFinished(true);
      
      // 完了メッセージを追加
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'タスクが完了しました。',
        timestamp: new Date(),
        steps: uiState.steps
      }]);
      
      // セッション状態を完了に更新
      if (sessionId) {
        fetch(`/api/chat-history?id=${sessionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            steps: uiState.steps
          })
        }).catch(console.error);
      }
      
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
  }, [uiState.sessionId, uiState.steps, sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    console.log("useEffect called");
    const initializeSession = async () => {
      if (initializationRef.current) return;
      initializationRef.current = true;

      if (initialMessage && !agentStateRef.current.sessionId) {
        setIsLoading(true);
        
        // AIの応答メッセージを追加
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'assistant',
          content: 'タスクを実行しています...',
          timestamp: new Date()
        }]);

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

          // Wait for browser session to be fully ready
          console.log("Waiting for browser session to initialize...");
          await new Promise(resolve => setTimeout(resolve, 10000));

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
                console.error("Failed to get next step:", nextStepData.error);
                break;
              }

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
                steps: [...prev.steps, nextStep],
              }));

              if (nextStep.tool === "CLOSE") {
                break;
              }

              // Execute the step
              const executeResponse = await fetch("/api/agent", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  goal: initialMessage,
                  sessionId: sessionData.sessionId,
                  step: nextStep,
                  action: "EXECUTE_STEP",
                }),
              });

              const executeData = await executeResponse.json();

              if (!executeData.success) {
                console.error("Failed to execute step:", executeData.error);
                break;
              }
            }
          }
        } catch (error) {
          console.error("Error initializing session:", error);
          setMessages(prev => [...prev.slice(0, -1), {
            id: Date.now().toString(),
            type: 'assistant',
            content: 'エラーが発生しました。もう一度お試しください。',
            timestamp: new Date()
          }]);
        } finally {
          setIsLoading(false);
        }
      }
    };

    initializeSession();
  }, [initialMessage, contextId, setContextId]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } },
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
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
      case "WAIT":
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case "NAVBACK":
        return <Navigation className="w-3 h-3 rotate-180" />;
      default:
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  const getToolVariant = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return "secondary";
      case "ACT":
        return "default";
      case "EXTRACT":
        return "outline";
      case "OBSERVE":
        return "secondary";
      case "CLOSE":
        return "default";
      case "WAIT":
        return "outline";
      case "NAVBACK":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getToolColor = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return "from-blue-500/20 to-cyan-500/10";
      case "ACT":
        return "from-green-500/20 to-emerald-500/10";
      case "EXTRACT":
        return "from-purple-500/20 to-pink-500/10";
      case "OBSERVE":
        return "from-yellow-500/20 to-orange-500/10";
      case "CLOSE":
        return "from-green-500/20 to-emerald-500/10";
      case "WAIT":
        return "from-gray-500/20 to-slate-500/10";
      case "NAVBACK":
        return "from-blue-500/20 to-indigo-500/10";
      default:
        return "from-gray-500/20 to-slate-500/10";
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // AIの応答を追加
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: '追加のタスクを実行しています...',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      // 新しいリクエストでエージェントを実行
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          goal: message,
          sessionId: uiState.sessionId,
          action: "START",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 成功レスポンスでメッセージを更新
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: `タスクを開始しました: ${message}` }
            : msg
        ));
      } else {
        // エラー時のメッセージ更新
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessage.id 
            ? { ...msg, content: 'エラーが発生しました。もう一度お試しください。' }
            : msg
        ));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? { ...msg, content: 'エラーが発生しました。もう一度お試しください。' }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  // AI状態の計算
  const getAIStatus = () => {
    if (isAgentFinished) return 'completed';
    if (isLoading || uiState.steps.length > 0) return 'working';
    return 'idle';
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'working':
        return {
          gradient: 'from-emerald-400 via-green-500 to-teal-600',
          icon: Brain,
          pulse: true,
          text: 'AI 実行中',
          description: 'タスクを処理しています'
        };
      case 'completed':
        return {
          gradient: 'from-blue-400 via-cyan-500 to-indigo-600',
          icon: Check,
          pulse: false,
          text: 'AI 完了',
          description: 'タスクが完了しました'
        };
      case 'idle':
      default:
        return {
          gradient: 'from-slate-400 via-gray-500 to-zinc-600',
          icon: Bot,
          pulse: false,
          text: 'AI 待機中',
          description: 'タスクをお待ちしています'
        };
    }
  };

  const currentStatus = getAIStatus();
  const statusConfig = getStatusConfig(currentStatus);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 text-white flex flex-col relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.nav
        className="relative z-50 flex justify-between items-center px-6 py-4 border-b border-white/10 bg-white/[0.02] backdrop-blur-xl"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ rotate: -180, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
            className="relative"
          >
            <div className={`w-12 h-12 bg-gradient-to-br ${statusConfig.gradient} rounded-full flex items-center justify-center shadow-lg relative ${
              statusConfig.pulse ? 'animate-pulse' : ''
            }`}>
              {/* 外側のリング効果 */}
              {statusConfig.pulse && (
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${statusConfig.gradient} opacity-30 animate-ping`} />
              )}
              
              {/* アイコン */}
              <statusConfig.icon className="w-6 h-6 text-white relative z-10" />
              
              {/* ステータスドット */}
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#171717] ${
                currentStatus === 'working' 
                  ? 'bg-green-400 animate-pulse' 
                  : currentStatus === 'completed'
                  ? 'bg-blue-400'
                  : 'bg-gray-400'
              }`} />
            </div>
          </motion.div>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-white text-lg">オープンオペレーター</h1>
              <Badge 
                variant="secondary" 
                className={`text-xs px-2 py-1 ${
                  currentStatus === 'working' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : currentStatus === 'completed'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}
              >
                {statusConfig.text}
              </Badge>
            </div>
            <p className="text-xs text-gray-400 mt-1">{statusConfig.description}</p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          className="gap-2 text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
        >
          <X className="w-4 h-4" />
          閉じる
          {!isMobile && (
            <kbd className="px-2 py-1 text-xs bg-[#2a2a2a] rounded-md border border-[#3a3a3a]">ESC</kbd>
          )}
        </Button>
      </motion.nav>
      
      <main className="flex-1 flex relative z-10">
        {/* Left Chat Panel */}
        <div className="w-1/2 flex flex-col border-r border-white/10 bg-white/[0.01] backdrop-blur-xl">
          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#3a3a3a transparent'
            }}
          >
            {messages.map((message) => (
              <motion.div
                key={message.id}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-3 max-w-[85%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user' 
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25' 
                      : 'bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div className={`rounded-2xl px-4 py-3 backdrop-blur-xl ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25'
                      : 'bg-white/10 text-white border border-white/20 shadow-lg'
                  }`}>
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <motion.div
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                className="flex justify-start"
              >
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[#2a2a2a] text-white rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      <span className="text-sm">処理中...</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-white/10 bg-white/[0.02] backdrop-blur-xl">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="追加のリクエストを入力..."
                disabled={isLoading}
                className="flex-1 bg-white/5 backdrop-blur-xl border border-white/20 focus:border-violet-500/50 text-white placeholder:text-gray-400 rounded-xl"
              />
              <Button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                variant="default"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>

        {/* Right Browser Panel */}
        <div className="w-1/2 flex flex-col bg-white/[0.01] backdrop-blur-xl">
          {/* Browser Header */}
          <div className="p-6 border-b border-white/10 bg-gradient-to-r from-white/[0.02] to-white/[0.05] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                  <Globe className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">ブラウザビュー</h2>
                  <p className="text-xs text-gray-400">リアルタイム実行環境</p>
                </div>
              </div>
              {uiState.sessionUrl && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400 font-medium">セッションアクティブ</span>
                </div>
              )}
            </div>
          </div>

          {/* Browser Content */}
          <div className="flex-1 p-6">
            {uiState.sessionUrl && !isAgentFinished ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring", damping: 15 }}
                className="h-full"
              >
                <div className="rounded-xl overflow-hidden shadow-2xl border border-[#2a2a2a] h-full bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
                  {/* ブラウザ風のタブバー */}
                  <div className="bg-gradient-to-r from-[#171717] to-[#1a1a1a] border-b border-[#2a2a2a] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                        </div>
                        <div className="h-4 w-px bg-[#3a3a3a]" />
                        <div className="bg-[#2a2a2a] rounded-lg px-3 py-1 flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                          <span className="text-xs text-gray-300 font-mono">browser.session</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 hover:bg-[#3a3a3a]"
                      >
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-[calc(100%-52px)] bg-black relative">
                    <iframe
                      src={uiState.sessionUrl}
                      className="w-full h-full"
                      sandbox="allow-same-origin allow-scripts allow-forms"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      title="Browser Session"
                    />
                    {/* オーバーレイ効果 */}
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/10 via-transparent to-black/5" />
                  </div>
                </div>
              </motion.div>
            ) : isAgentFinished ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="h-full flex items-center justify-center"
              >
                <Card className="bg-gradient-to-br from-[#171717] to-[#1a1a1a] border-[#2a2a2a] shadow-2xl max-w-md w-full">
                  <CardContent className="p-8 text-center">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", damping: 10 }}
                      className="w-20 h-20 bg-gradient-to-br from-emerald-500/30 to-green-600/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20"
                    >
                      <Check className="w-10 h-10 text-green-400" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      セッション完了
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      すべてのタスクが正常に実行されました
                    </p>
                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-green-400">
                      <div className="w-2 h-2 bg-green-400 rounded-full" />
                      <span>タスク完了</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="h-full flex items-center justify-center"
              >
                <Card className="bg-gradient-to-br from-[#171717] to-[#1a1a1a] border-[#2a2a2a] shadow-2xl max-w-md w-full">
                  <CardContent className="p-8 text-center">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", damping: 10 }}
                      className="w-20 h-20 bg-gradient-to-br from-blue-500/30 to-cyan-600/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20"
                    >
                      <Brain className="w-10 h-10 text-blue-400" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      セッション準備中
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed mb-4">
                      ブラウザセッションを初期化しています...
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Steps Summary */}
          {uiState.steps.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 border-t border-[#2a2a2a] bg-gradient-to-r from-[#171717]/50 to-[#1a1a1a]/50 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">実行ステップ</span>
                    <p className="text-xs text-gray-400">AI実行履歴</p>
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30 px-3 py-1"
                >
                  {uiState.steps.length} steps
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {uiState.steps.slice(-6).map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Badge 
                      variant={getToolVariant(step.tool) as any}
                      className={`text-xs gap-2 px-3 py-1.5 bg-gradient-to-r ${getToolColor(step.tool)} border border-current/20 backdrop-blur-sm hover:scale-105 transition-transform`}
                    >
                      {getToolIcon(step.tool)}
                      <span className="font-medium">{step.tool}</span>
                    </Badge>
                  </motion.div>
                ))}
                {uiState.steps.length > 6 && (
                  <Badge 
                    variant="outline" 
                    className="text-xs bg-gray-500/10 text-gray-400 border-gray-500/30 px-3 py-1.5"
                  >
                    +{uiState.steps.length - 6} more
                  </Badge>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </motion.div>
  );
}
