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
  Plus,
  Search,
  Clock,
  Activity,
  ArrowRight
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
  type: 'user' | 'assistant' | 'system' | 'step';
  content: string;
  timestamp: Date;
  steps?: BrowserStep[];
  step?: BrowserStep;
  isSearchResult?: boolean;
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
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isHistorySession, setIsHistorySession] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        duration: 0.6,
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0,
      transition: { duration: 0.3 }
    }
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring", 
        damping: 15,
        stiffness: 100
      }
    }
  };

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, []);

  // スクリーンショット取得関数
  const takeScreenshot = useCallback(async () => {
    if (!uiState.sessionId) return;
    
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SCREENSHOT',
          sessionId: uiState.sessionId
        })
      });
      
      const data = await response.json();
      if (data.success && data.screenshot) {
        setCurrentScreenshot(data.screenshot);
      }
    } catch (error) {
      console.error('スクリーンショット取得エラー:', error);
    }
  }, [uiState.sessionId]);

  // 2秒ごとのスクリーンショット取得
  useEffect(() => {
    if (uiState.sessionId && !isAgentFinished) {
      // 初回スクリーンショット
      takeScreenshot();
      
      // 2秒間隔でスクリーンショット取得
      screenshotIntervalRef.current = setInterval(takeScreenshot, 2000);
      
      return () => {
        if (screenshotIntervalRef.current) {
          clearInterval(screenshotIntervalRef.current);
        }
      };
    }
  }, [uiState.sessionId, isAgentFinished, takeScreenshot]);

  // ステップ追加時にチャットメッセージに表示
  const addStepMessage = useCallback((step: BrowserStep, stepNumber: number) => {
    const stepMessage: ChatMessage = {
      id: `step-${Date.now()}`,
      type: 'step',
      content: step.text,
      timestamp: new Date(),
      step: { ...step, stepNumber }
    };
    
    setMessages(prev => [...prev, stepMessage]);
  }, []);

  // 検索結果メッセージ追加
  const addSearchResult = useCallback((query: string, results: any) => {
    const resultMessage: ChatMessage = {
      id: `search-${Date.now()}`,
      type: 'assistant',
      content: `「${query}」の検索結果を取得しました。`,
      timestamp: new Date(),
      isSearchResult: true
    };
    
    setMessages(prev => [...prev, resultMessage]);
  }, []);

  // 質問かどうかを判定する関数
  const isQuestion = useCallback((text: string) => {
    const questionPatterns = [
      /[？?]$/,
      /^(何|なに|どの|どこ|いつ|誰|どうして|なぜ|どのように|どうやって)/,
      /について教えて/,
      /を調べて/,
      /はいくら/,
      /の価格/,
      /の値段/
    ];
    
    return questionPatterns.some(pattern => pattern.test(text));
  }, []);

  useEffect(() => {
    if (initialMessage && sessionId) {
      // 過去のセッションを読み込む場合
      loadHistorySession();
    } else if (initialMessage) {
      // 新しいセッションの場合
      setMessages([{
        id: Date.now().toString(),
        type: 'user',
        content: initialMessage,
        timestamp: new Date()
      }]);
    }
  }, [initialMessage, sessionId]);

  const loadHistorySession = async () => {
    if (!sessionId) return;
    
    setIsHistorySession(true);
    try {
      const response = await fetch(`/api/chat-history?id=${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        
        // 保存されたメッセージがある場合はそれを読み込み
        if (sessionData.messages && sessionData.messages.length > 0) {
          setMessages(sessionData.messages);
        } else {
          // 旧形式の場合は基本メッセージのみ
          setMessages([
            {
              id: '1',
              type: 'user',
              content: sessionData.message,
              timestamp: new Date(sessionData.timestamp)
            }
          ]);
        }
        
        // ステップがある場合は設定
        if (sessionData.steps) {
          setUiState(prev => ({ ...prev, steps: sessionData.steps }));
        }
        
        // 完了済みセッションの場合
        if (sessionData.status === 'completed') {
          setIsAgentFinished(true);
        }
      }
    } catch (error) {
      console.error('履歴セッション読み込みエラー:', error);
    }
  };

  useEffect(() => {
    if (
      uiState.steps.length > 0 &&
      uiState.steps[uiState.steps.length - 1].tool === "CLOSE"
    ) {
      setIsAgentFinished(true);
      
      // スクリーンショット取得停止
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      
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

      // 過去のセッションの場合は新しいエージェント実行をしない
      if (sessionId) {
        await loadHistorySession();
        return;
      }

      if (initialMessage && !agentStateRef.current.sessionId) {
        setIsLoading(true);
        
        // 質問形式かどうかをチェック
        if (isQuestion(initialMessage)) {
          // 検索処理メッセージを追加
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'assistant',
            content: 'ウェブを検索して情報を調べています...',
            timestamp: new Date()
          }]);
        } else {
          // 通常のタスク実行メッセージ
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'assistant',
            content: 'タスクを実行しています...',
            timestamp: new Date()
          }]);
        }

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

          // エージェント実行開始
          await runAgent(sessionData.sessionId, initialMessage);
        } catch (error) {
          console.error("Session initialization failed:", error);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'assistant',
            content: 'エラーが発生しました。セッションの初期化に失敗しました。',
            timestamp: new Date()
          }]);
        } finally {
          setIsLoading(false);
        }
      }
    };

    initializeSession();
  }, [initialMessage, contextId, setContextId, isQuestion, sessionId]);

  const runAgent = async (sessionId: string, goal: string) => {
    try {
      let currentSteps: BrowserStep[] = [];
      let stepNumber = 1;

      // 最初のステップを開始
      const startResponse = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          goal,
          action: "START",
        }),
      });

      const startData = await startResponse.json();
      if (startData.success) {
        currentSteps = startData.steps;
        setUiState(prev => ({ ...prev, steps: currentSteps }));
        
        // ステップをチャットに追加
        addStepMessage(startData.result, stepNumber++);
      }

      // ステップを継続実行
      while (true) {
        // 次のステップを取得
        const nextStepResponse = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            goal,
            action: "GET_NEXT_STEP",
            previousSteps: currentSteps,
          }),
        });

        const nextStepData = await nextStepResponse.json();
        if (nextStepData.success) {
          currentSteps = nextStepData.steps;
          setUiState(prev => ({ ...prev, steps: currentSteps }));

          if (nextStepData.done) {
            // 最終ステップをチャットに追加
            addStepMessage(nextStepData.result, stepNumber);
            break;
          }

          // ステップをチャットに追加
          addStepMessage(nextStepData.result, stepNumber++);

          // ステップを実行
          const executeResponse = await fetch("/api/agent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId,
              action: "EXECUTE_STEP",
              step: nextStepData.result,
            }),
          });

          const executeData = await executeResponse.json();
          if (executeData.done) {
            break;
          }

          // 実行結果があれば検索結果として表示
          if (executeData.extraction && isQuestion(goal)) {
            addSearchResult(goal, executeData.extraction);
          }
        } else {
          console.error("エージェントステップエラー:", nextStepData.error);
          break;
        }

        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error("エージェント実行エラー:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'エラーが発生しました。タスクの実行中に問題が発生しました。',
        timestamp: new Date()
      }]);
    }
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return <Navigation className="w-3 h-3" />;
      case "ACT":
        return <Activity className="w-3 h-3" />;
      case "EXTRACT":
        return <FileText className="w-3 h-3" />;
      case "OBSERVE":
        return <Eye className="w-3 h-3" />;
      case "WAIT":
        return <Clock className="w-3 h-3" />;
      case "NAVBACK":
        return <ArrowRight className="w-3 h-3 rotate-180" />;
      case "CLOSE":
        return <Check className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  const getToolVariant = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return "default";
      case "ACT":
        return "secondary";
      case "EXTRACT":
        return "success";
      case "OBSERVE":
        return "warning";
      case "WAIT":
        return "minimal";
      case "NAVBACK":
        return "outline";
      case "CLOSE":
        return "success";
      default:
        return "secondary";
    }
  };

  const getToolColor = (tool: string) => {
    switch (tool) {
      case "GOTO":
        return "from-[#00ADB5]/20 to-[#00ADB5]/10 text-[#00ADB5]";
      case "ACT":
        return "from-purple-500/20 to-purple-600/10 text-purple-400";
      case "EXTRACT":
        return "from-green-500/20 to-green-600/10 text-green-400";
      case "OBSERVE":
        return "from-yellow-500/20 to-yellow-600/10 text-yellow-400";
      case "WAIT":
        return "from-gray-500/20 to-gray-600/10 text-gray-400";
      case "NAVBACK":
        return "from-blue-500/20 to-blue-600/10 text-blue-400";
      case "CLOSE":
        return "from-emerald-500/20 to-emerald-600/10 text-emerald-400";
      default:
        return "from-gray-500/20 to-gray-600/10 text-gray-400";
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    
    // 質問形式の場合は検索処理
    if (isQuestion(message)) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'ウェブを検索して回答を調べています...',
        timestamp: new Date()
      }]);
      
      // 新しいエージェント実行を開始
      if (uiState.sessionId) {
        await runAgent(uiState.sessionId, message);
      }
    } else {
      // 通常のタスク実行
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'タスクを実行しています...',
        timestamp: new Date()
      }]);
      
      if (uiState.sessionId) {
        await runAgent(uiState.sessionId, message);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
  };

  const getAIStatus = () => {
    if (isLoading) return 'working';
    if (isAgentFinished) return 'completed';
    return 'idle';
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'working':
        return {
          gradient: 'from-[#00ADB5] via-cyan-500 to-blue-600',
          icon: Brain,
          pulse: true,
          text: 'AI 実行中',
          description: 'タスクを処理しています'
        };
      case 'completed':
        return {
          gradient: 'from-emerald-500 via-green-500 to-teal-600',
          icon: Check,
          pulse: false,
          text: 'AI 完了',
          description: 'すべてのタスクが完了しました'
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

  // メッセージ保存機能
  const saveMessagesToHistory = useCallback(async () => {
    if (!sessionId || isHistorySession) return;
    
    try {
      await fetch(`/api/chat-history?id=${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages,
          steps: uiState.steps
        })
      });
    } catch (error) {
      console.error('メッセージ保存エラー:', error);
    }
  }, [sessionId, messages, uiState.steps, isHistorySession]);

  // メッセージが更新されるたびに保存
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToHistory();
    }
  }, [messages, saveMessagesToHistory]);

  // ステップ展開/折りたたみ
  const toggleStepExpansion = (stepId: string) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  return (
    <motion.div
      className="min-h-screen bg-[#222831] text-[#EEEEEE] flex flex-col relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.nav
        className="relative z-50 flex justify-between items-center px-6 py-4 border-b border-[#495057] bg-[#393E46]/80 backdrop-blur-xl"
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
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#222831] ${
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
              <h1 className="font-semibold text-[#EEEEEE] text-lg">オープンオペレーター</h1>
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
            <p className="text-xs text-[#CED4DA] mt-1">{statusConfig.description}</p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          className="gap-2 text-[#CED4DA] hover:text-[#EEEEEE] hover:bg-[#495057]"
        >
          <X className="w-4 h-4" />
          閉じる
          {!isMobile && (
            <kbd className="px-2 py-1 text-xs bg-[#495057] rounded-md border border-[#6C757D]">ESC</kbd>
          )}
        </Button>
      </motion.nav>
      
      <main className="flex-1 flex relative z-10">
        {/* Left Chat Panel */}
        <div className="w-1/2 flex flex-col border-r border-[#495057] bg-[#393E46]/50 backdrop-blur-xl">
          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#495057 transparent',
              maxHeight: 'calc(100vh - 200px)'
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
                      ? 'bg-[#00ADB5] shadow-lg shadow-[#00ADB5]/25' 
                      : message.type === 'step'
                      ? 'step-indicator'
                      : 'bg-[#495057] backdrop-blur-xl border border-[#6C757D] shadow-lg'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-[#222831]" />
                    ) : message.type === 'step' ? (
                      <span className="text-xs font-bold">{message.step?.stepNumber || '•'}</span>
                    ) : (
                      <Bot className="w-4 h-4 text-[#EEEEEE]" />
                    )}
                  </div>
                  
                  {/* Message Content */}
                  <div className={`rounded-2xl px-4 py-3 backdrop-blur-xl ${
                    message.type === 'user'
                      ? 'bg-[#00ADB5] text-[#222831] shadow-lg shadow-[#00ADB5]/25'
                      : message.type === 'step'
                      ? 'bg-[#495057] text-[#EEEEEE] border border-[#6C757D] shadow-lg'
                      : message.isSearchResult
                      ? 'search-result'
                      : 'bg-[#495057] text-[#EEEEEE] border border-[#6C757D] shadow-lg'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        {message.step && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {getToolIcon(message.step.tool)}
                                <Badge 
                                  variant={getToolVariant(message.step.tool) as any}
                                  className={`text-xs ${getToolColor(message.step.tool)}`}
                                >
                                  {message.step.tool}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleStepExpansion(message.id)}
                                className="h-6 px-2 text-xs text-[#CED4DA] hover:text-[#EEEEEE]"
                              >
                                {expandedSteps.has(message.id) ? '▼' : '▶'}
                              </Button>
                            </div>
                            
                            {expandedSteps.has(message.id) && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2 pl-2 border-l-2 border-[#6C757D]/30"
                              >
                                <div>
                                  <p className="text-xs text-[#CED4DA] font-medium">アクション:</p>
                                  <p className="text-xs text-[#EEEEEE] font-mono bg-[#222831] p-2 rounded mt-1 break-all">
                                    {message.step.instruction}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-[#CED4DA] font-medium">推論:</p>
                                  <p className="text-xs text-[#EEEEEE] italic mt-1">
                                    {message.step.reasoning}
                                  </p>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs opacity-70 mt-2">
                      {new Date(message.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
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
                  <div className="w-8 h-8 rounded-full bg-[#495057] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-[#EEEEEE]" />
                  </div>
                  <div className="bg-[#495057] text-[#EEEEEE] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#00ADB5]" />
                      <span className="text-sm">処理中...</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 border-t border-[#495057] bg-[#393E46]/80 backdrop-blur-xl">
            {!isHistorySession ? (
              <form onSubmit={handleSubmit} className="flex gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="追加のリクエストを入力..."
                  disabled={isLoading}
                  className="flex-1 bg-[#495057] backdrop-blur-xl border border-[#6C757D] focus:border-[#00ADB5] text-[#EEEEEE] placeholder:text-[#CED4DA] rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-[#00ADB5] hover:bg-[#009AA3] text-[#222831]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-[#CED4DA]">
                  これは過去のセッションです。新しいチャットを開始するには「新しいチャット」ボタンを押してください。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Browser Panel */}
        <div className="w-1/2 flex flex-col bg-[#393E46]/50 backdrop-blur-xl">
          {/* Browser Header */}
          <div className="p-6 border-b border-[#495057] bg-[#393E46]/80 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#00ADB5]/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-[#00ADB5]/30">
                  <Globe className="w-5 h-5 text-[#00ADB5]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[#EEEEEE]">ブラウザプレビュー</h2>
                  <p className="text-xs text-[#CED4DA]">リアルタイムスクリーンショット</p>
                </div>
              </div>
              {uiState.sessionId && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-green-400 font-medium">セッションアクティブ</span>
                </div>
              )}
            </div>
          </div>

          {/* Browser Content */}
          <div className="flex-1 p-6">
            {currentScreenshot && !isAgentFinished ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring", damping: 15 }}
                className="h-full"
              >
                <div className="rounded-xl overflow-hidden shadow-2xl border border-[#495057] h-full bg-[#222831] screenshot-preview">
                  {/* ブラウザ風のタブバー */}
                  <div className="bg-[#393E46] border-b border-[#495057] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                        </div>
                        <div className="h-4 w-px bg-[#495057]" />
                        <div className="bg-[#495057] rounded-lg px-3 py-1 flex items-center gap-2">
                          <div className="w-2 h-2 bg-[#00ADB5] rounded-full animate-pulse" />
                          <span className="text-xs text-[#CED4DA] font-mono">browser.session</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 hover:bg-[#495057]"
                      >
                        <ExternalLink className="w-3 h-3 text-[#CED4DA]" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-[calc(100%-52px)] bg-black relative p-4">
                    <Image
                      src={`data:image/png;base64,${currentScreenshot}`}
                      alt="Browser Screenshot"
                      width={800}
                      height={600}
                      className="w-full h-full object-contain rounded-lg border border-[#495057]"
                      priority
                    />
                    {/* 更新インジケーター */}
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#393E46]/80 backdrop-blur-sm px-3 py-1 rounded-full border border-[#495057]">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs text-[#CED4DA]">2秒ごとに更新</span>
                    </div>
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
                <Card className="bg-[#393E46] border-[#495057] shadow-2xl max-w-md w-full">
                  <CardContent className="p-8 text-center">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", damping: 10 }}
                      className="w-20 h-20 bg-gradient-to-br from-emerald-500/30 to-green-600/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/20"
                    >
                      <Check className="w-10 h-10 text-green-400" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-[#EEEEEE] mb-3 bg-gradient-to-r from-[#EEEEEE] to-[#CED4DA] bg-clip-text text-transparent">
                      セッション完了
                    </h3>
                    <p className="text-[#CED4DA] text-sm leading-relaxed">
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
                <Card className="bg-[#393E46] border-[#495057] shadow-2xl max-w-md w-full">
                  <CardContent className="p-8 text-center">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", damping: 10 }}
                      className="w-20 h-20 bg-gradient-to-br from-[#00ADB5]/30 to-cyan-600/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#00ADB5]/20"
                    >
                      <Brain className="w-10 h-10 text-[#00ADB5]" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-[#EEEEEE] mb-3 bg-gradient-to-r from-[#EEEEEE] to-[#CED4DA] bg-clip-text text-transparent">
                      セッション準備中
                    </h3>
                    <p className="text-[#CED4DA] text-sm leading-relaxed mb-4">
                      ブラウザセッションを初期化しています...
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[#00ADB5] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-2 h-2 bg-[#00ADB5] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-[#00ADB5] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
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
              className="p-6 border-t border-[#495057] bg-[#393E46]/80 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#00ADB5]/20 to-slate-500/20 rounded-full flex items-center justify-center border border-[#00ADB5]/30">
                    <Sparkles className="w-4 h-4 text-[#00ADB5]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#EEEEEE]">実行ステップ</span>
                    <p className="text-xs text-[#CED4DA]">AI実行履歴</p>
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-[#495057] text-[#CED4DA] border-[#6C757D] px-3 py-1"
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
                    className="text-xs bg-[#495057] text-[#CED4DA] border-[#6C757D] px-3 py-1.5"
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
