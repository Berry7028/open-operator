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

  // メッセージが更新されたら自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // データベース保存機能
  const saveMessageToDb = useCallback(async (message: ChatMessage) => {
    if (!sessionId || isHistorySession) return;
    
    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          type: message.type,
          content: message.content,
          metadata: {
            timestamp: message.timestamp,
            step: message.step,
            isSearchResult: message.isSearchResult
          }
        })
      });
      
      if (!response.ok) {
        console.error('メッセージ保存失敗:', await response.text());
      }
    } catch (error) {
      console.error('メッセージ保存エラー:', error);
    }
  }, [sessionId, isHistorySession]);

  const saveStepToDb = useCallback(async (step: BrowserStep, stepNumber: number) => {
    if (!sessionId || isHistorySession) return;
    
    try {
      const response = await fetch('/api/chat/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          stepNumber,
          tool: step.tool,
          instruction: step.instruction,
          reasoning: step.reasoning,
          text: step.text
        })
      });
      
      if (!response.ok) {
        console.error('ステップ保存失敗:', await response.text());
      }
    } catch (error) {
      console.error('ステップ保存エラー:', error);
    }
  }, [sessionId, isHistorySession]);

  const updateSessionStatus = useCallback(async (status: 'in-progress' | 'completed' | 'error', finalResult?: string) => {
    if (!sessionId || isHistorySession) return;
    
    try {
      const response = await fetch(`/api/chat-history?id=${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          finalResult
        })
      });
      
      if (!response.ok) {
        console.error('セッション更新失敗:', await response.text());
      }
    } catch (error) {
      console.error('セッション更新エラー:', error);
    }
  }, [sessionId, isHistorySession]);

  // スクリーンショット取得機能
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

  // スクリーンショット自動更新
  useEffect(() => {
    if (uiState.sessionId && !isAgentFinished) {
      takeScreenshot();
      screenshotIntervalRef.current = setInterval(takeScreenshot, 2000);
      
      return () => {
        if (screenshotIntervalRef.current) {
          clearInterval(screenshotIntervalRef.current);
        }
      };
    }
  }, [uiState.sessionId, isAgentFinished, takeScreenshot]);

  // ステップ追加時の処理
  const addStepMessage = useCallback((step: BrowserStep, stepNumber: number) => {
    const stepMessage: ChatMessage = {
      id: `step-${Date.now()}`,
      type: 'step',
      content: step.text,
      timestamp: new Date(),
      step: { ...step, stepNumber }
    };
    
    setMessages(prev => [...prev, stepMessage]);
    
    // データベースに保存
    saveStepToDb(step, stepNumber);
    saveMessageToDb(stepMessage);
  }, [saveStepToDb, saveMessageToDb]);

  // 履歴セッション読み込み
  const loadHistorySession = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/chat-history?id=${sessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        
        // メッセージを復元
        if (sessionData.messages) {
          const restoredMessages = sessionData.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.created_at || msg.timestamp)
          }));
          setMessages(restoredMessages);
        }
        
        // ステップを復元
        if (sessionData.steps) {
          setUiState(prev => ({
            ...prev,
            steps: sessionData.steps
          }));
        }
        
        setIsHistorySession(true);
        
        if (sessionData.status === 'completed') {
          setIsAgentFinished(true);
        }
      }
    } catch (error) {
      console.error('履歴読み込みエラー:', error);
    }
  }, [sessionId]);

  // AIエージェント実行
  const runAgent = useCallback(async (sessionId: string, goal: string) => {
    try {
      setIsLoading(true);
      agentStateRef.current.isLoading = true;
      
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RUN',
          sessionId: sessionId,
          goal: goal
        })
      });
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let stepNumber = 1;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'step') {
                addStepMessage(data.step, stepNumber++);
                
                setUiState(prev => ({
                  ...prev,
                  steps: [...prev.steps, data.step]
                }));
                
                agentStateRef.current.steps.push(data.step);
              }
            } catch (error) {
              console.error('データ解析エラー:', error);
            }
          }
        }
      }
      
      // 完了処理
      setIsAgentFinished(true);
      await updateSessionStatus('completed', 'タスクが正常に完了しました。');
      
    } catch (error) {
      console.error('AIエージェント実行エラー:', error);
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: 'AIエージェントの実行中にエラーが発生しました。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      saveMessageToDb(errorMessage);
      
      await updateSessionStatus('error', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
      agentStateRef.current.isLoading = false;
    }
  }, [addStepMessage, updateSessionStatus, saveMessageToDb]);

  // 初期化処理
  useEffect(() => {
    if (initializationRef.current) return;
    
    const initializeSession = async () => {
      initializationRef.current = true;
      
      if (sessionId) {
        // 既存セッションの読み込み
        await loadHistorySession();
      } else if (initialMessage) {
        // 新しいセッション開始
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          type: 'user',
          content: initialMessage,
          timestamp: new Date()
        };
        setMessages([userMessage]);
        
        // セッション作成とブラウザ初期化
        try {
          setIsLoading(true);
          
          const sessionResponse = await fetch('/api/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              contextId: contextId
            })
          });
          
          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json();
            
            setUiState(prev => ({
              ...prev,
              sessionId: sessionData.sessionId,
              sessionUrl: sessionData.sessionUrl
            }));
            
            agentStateRef.current.sessionId = sessionData.sessionId;
            agentStateRef.current.sessionUrl = sessionData.sessionUrl;
            
            // AIエージェント実行
            await runAgent(sessionData.sessionId, initialMessage);
          }
        } catch (error) {
          console.error('セッション初期化エラー:', error);
          const errorMessage: ChatMessage = {
            id: `error-${Date.now()}`,
            type: 'assistant',
            content: 'セッションの初期化中にエラーが発生しました。',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorMessage]);
          saveMessageToDb(errorMessage);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    initializeSession();
  }, [initialMessage, sessionId, contextId, loadHistorySession, runAgent, saveMessageToDb]);

  // ツール関連のヘルパー関数
  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'GOTO': return <Navigation className="w-3 h-3" />;
      case 'ACT': return <Activity className="w-3 h-3" />;
      case 'EXTRACT': return <FileText className="w-3 h-3" />;
      case 'OBSERVE': return <Eye className="w-3 h-3" />;
      case 'SEARCH': return <Search className="w-3 h-3" />;
      case 'WAIT': return <Clock className="w-3 h-3" />;
      default: return <ArrowRight className="w-3 h-3" />;
    }
  };

  const getToolVariant = (tool: string) => {
    switch (tool) {
      case 'GOTO': return 'default';
      case 'ACT': return 'secondary';
      case 'EXTRACT': return 'outline';
      case 'OBSERVE': return 'default';
      case 'SEARCH': return 'secondary';
      case 'WAIT': return 'outline';
      default: return 'default';
    }
  };

  const getToolColor = (tool: string) => {
    switch (tool) {
      case 'GOTO': return 'from-blue-500/30 to-blue-600/30 text-blue-400';
      case 'ACT': return 'from-green-500/30 to-green-600/30 text-green-400';
      case 'EXTRACT': return 'from-purple-500/30 to-purple-600/30 text-purple-400';
      case 'OBSERVE': return 'from-yellow-500/30 to-yellow-600/30 text-yellow-400';
      case 'SEARCH': return 'from-cyan-500/30 to-cyan-600/30 text-cyan-400';
      case 'WAIT': return 'from-gray-500/30 to-gray-600/30 text-gray-400';
      default: return 'from-gray-500/30 to-gray-600/30 text-gray-400';
    }
  };

  // メッセージ送信処理
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    await saveMessageToDb(userMessage);
    
    if (uiState.sessionId) {
      await runAgent(uiState.sessionId, message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(inputValue);
    setInputValue("");
  };

  // ステータス関連
  const getAIStatus = () => {
    if (isLoading) return 'working';
    if (isAgentFinished) return 'completed';
    return 'idle';
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'working':
        return {
          gradient: 'from-[#EC625F] via-[#EC625F] to-[#d85450]',
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
          gradient: 'from-[#525252] via-[#414141] to-[#313131]',
          icon: Bot,
          pulse: false,
          text: 'AI 待機中',
          description: 'タスクをお待ちしています'
        };
    }
  };

  const currentStatus = getAIStatus();
  const statusConfig = getStatusConfig(currentStatus);

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
      className="min-h-screen bg-[#313131] text-white flex flex-col relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* ヘッダー */}
      <motion.nav
        className="relative z-50 flex justify-between items-center px-6 py-4 border-b border-[#525252] bg-[#414141]/80 backdrop-blur-xl"
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
              {statusConfig.pulse && (
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${statusConfig.gradient} opacity-30 animate-ping`} />
              )}
              
              <statusConfig.icon className="w-6 h-6 text-white relative z-10" />
              
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#313131] ${
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
            <p className="text-xs text-gray-300 mt-1">{statusConfig.description}</p>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          className="gap-2 text-gray-300 hover:text-white hover:bg-[#525252]"
        >
          <X className="w-4 h-4" />
          閉じる
          {!isMobile && (
            <kbd className="px-2 py-1 text-xs bg-[#525252] rounded-md border border-[#525252]">ESC</kbd>
          )}
        </Button>
      </motion.nav>
      
      <main className="flex-1 flex relative z-10">
        {/* チャットパネル */}
        <div className="w-1/2 flex flex-col border-r border-[#525252] bg-[#414141]/50 backdrop-blur-xl">
          {/* メッセージエリア */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-6 space-y-4"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#525252 transparent',
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
                  {/* アバター */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'user' 
                      ? 'bg-[#EC625F] shadow-lg shadow-[#EC625F]/25' 
                      : message.type === 'step'
                      ? 'bg-[#525252] border border-[#525252]'
                      : 'bg-[#525252] backdrop-blur-xl border border-[#525252] shadow-lg'
                  }`}>
                    {message.type === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : message.type === 'step' ? (
                      <span className="text-xs font-bold text-white">{message.step?.stepNumber || '•'}</span>
                    ) : (
                      <Bot className="w-4 h-4 text-white" />
                    )}
                  </div>
                  
                  {/* メッセージ内容 */}
                  <div className={`rounded-2xl px-4 py-3 backdrop-blur-xl ${
                    message.type === 'user'
                      ? 'bg-[#EC625F] text-white shadow-lg shadow-[#EC625F]/25'
                      : 'bg-[#525252] text-white border border-[#525252] shadow-lg'
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
                                className="h-6 px-2 text-xs text-gray-300 hover:text-white"
                              >
                                {expandedSteps.has(message.id) ? '▼' : '▶'}
                              </Button>
                            </div>
                            
                            {expandedSteps.has(message.id) && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-2 pl-2 border-l-2 border-[#525252]/30"
                              >
                                <div>
                                  <p className="text-xs text-gray-300 font-medium">アクション:</p>
                                  <p className="text-xs text-white font-mono bg-[#313131] p-2 rounded mt-1 break-all">
                                    {message.step.instruction}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-300 font-medium">推論:</p>
                                  <p className="text-xs text-white italic mt-1">
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
                  <div className="w-8 h-8 rounded-full bg-[#525252] flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-[#525252] text-white rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#EC625F]" />
                      <span className="text-sm">処理中...</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* 入力エリア */}
          <div className="p-6 border-t border-[#525252] bg-[#414141]/80 backdrop-blur-xl">
            {!isHistorySession ? (
              <form onSubmit={handleSubmit} className="flex gap-3">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="追加のリクエストを入力..."
                  disabled={isLoading}
                  className="flex-1 bg-[#525252] backdrop-blur-xl border border-[#525252] focus:border-[#EC625F] text-white placeholder:text-gray-300 rounded-xl"
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-[#EC625F] hover:bg-[#d85450] text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-300">
                  これは過去のセッションです。新しいチャットを開始するには「新しいチャット」ボタンを押してください。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ブラウザパネル */}
        <div className="w-1/2 flex flex-col bg-[#414141]/50 backdrop-blur-xl">
          {/* ブラウザヘッダー */}
          <div className="p-6 border-b border-[#525252] bg-[#414141]/80 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#EC625F]/20 to-[#EC625F]/20 rounded-full flex items-center justify-center border border-[#EC625F]/30">
                  <Globe className="w-5 h-5 text-[#EC625F]" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">ブラウザプレビュー</h2>
                  <p className="text-xs text-gray-300">リアルタイムスクリーンショット</p>
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

          {/* ブラウザ内容 */}
          <div className="flex-1 p-6">
            {currentScreenshot && !isAgentFinished ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: "spring", damping: 15 }}
                className="h-full"
              >
                <div className="rounded-xl overflow-hidden shadow-2xl border border-[#525252] h-full bg-[#313131]">
                  {/* ブラウザタブバー */}
                  <div className="bg-[#414141] border-b border-[#525252] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500 shadow-lg shadow-red-500/50" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-lg shadow-yellow-500/50" />
                          <div className="w-3 h-3 rounded-full bg-green-500 shadow-lg shadow-green-500/50" />
                        </div>
                        <div className="h-4 w-px bg-[#525252]" />
                        <div className="bg-[#525252] rounded-lg px-3 py-1 flex items-center gap-2">
                          <div className="w-2 h-2 bg-[#EC625F] rounded-full animate-pulse" />
                          <span className="text-xs text-gray-300 font-mono">browser.session</span>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 hover:bg-[#525252]"
                      >
                        <ExternalLink className="w-3 h-3 text-gray-300" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-[calc(100%-52px)] bg-black relative p-4">
                    <Image
                      src={`data:image/png;base64,${currentScreenshot}`}
                      alt="Browser Screenshot"
                      width={800}
                      height={600}
                      className="w-full h-full object-contain rounded-lg border border-[#525252]"
                      priority
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-2 bg-[#414141]/80 backdrop-blur-sm px-3 py-1 rounded-full border border-[#525252]">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      <span className="text-xs text-gray-300">2秒ごとに更新</span>
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
                <Card className="bg-[#414141] border-[#525252] shadow-2xl max-w-md w-full">
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
                    <p className="text-gray-300 text-sm leading-relaxed">
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
                <Card className="bg-[#414141] border-[#525252] shadow-2xl max-w-md w-full">
                  <CardContent className="p-8 text-center">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring", damping: 10 }}
                      className="w-20 h-20 bg-gradient-to-br from-[#EC625F]/30 to-[#EC625F]/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#EC625F]/20"
                    >
                      <Brain className="w-10 h-10 text-[#EC625F]" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-white mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      セッション準備中
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-4">
                      ブラウザセッションを初期化しています...
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[#EC625F] rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-2 h-2 bg-[#EC625F] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-[#EC625F] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* ステップサマリー */}
          {uiState.steps.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 border-t border-[#525252] bg-[#414141]/80 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-[#EC625F]/20 to-[#525252]/20 rounded-full flex items-center justify-center border border-[#EC625F]/30">
                    <Sparkles className="w-4 h-4 text-[#EC625F]" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">実行ステップ</span>
                    <p className="text-xs text-gray-300">AI実行履歴</p>
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs bg-[#525252] text-gray-300 border-[#525252] px-3 py-1"
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
                    className="text-xs bg-[#525252] text-gray-300 border-[#525252] px-3 py-1.5"
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