"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatFeed from "./components/ChatFeed";
import Image from "next/image";
import posthog from "posthog-js";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { 
  MessageSquare, 
  History, 
  Settings, 
  Trash2, 
  Menu, 
  X, 
  Plus, 
  Send,
  Bot,
  User,
  PenSquare,
  Clock,
  Archive,
  Brain,
  Globe,
  ArrowRight,
  Github,
  ExternalLink,
  Zap,
  Sparkles,
  Star
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import ChatBlock from "./components/ChatBlock";
import { PostHogProvider } from "./components/PosthogProvider";

interface ChatSession {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'error';
}

export default function Home() {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");

  // チャット履歴を取得
  useEffect(() => {
    fetchChatHistory();
  }, []);

  const fetchChatHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch('/api/chat-history');
      if (response.ok) {
        const data = await response.json();
        setChatHistory(data);
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const startChat = useCallback(
    async (finalMessage: string) => {
      setInitialMessage(finalMessage);
      setIsChatVisible(true);
      setInputValue("");

      // 新しいセッションを作成
      try {
        const response = await fetch('/api/chat-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: finalMessage.substring(0, 50) + (finalMessage.length > 50 ? '...' : ''),
            message: finalMessage,
            status: 'in-progress'
          })
        });
        
        if (response.ok) {
          const newSession = await response.json();
          setSelectedSessionId(newSession.id);
          fetchChatHistory();
        }
      } catch (error) {
        console.error('Failed to create chat session:', error);
      }

      try {
        posthog.capture("submit_message", {
          message: finalMessage,
        });
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/chat-history?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchChatHistory();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const loadSession = (session: ChatSession) => {
    setSelectedSessionId(session.id);
    setInitialMessage(session.message);
    setIsChatVisible(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      startChat(inputValue.trim());
    }
  };

  const startNewChat = () => {
    setSelectedSessionId(null);
    setInitialMessage("");
    setIsChatVisible(false);
    setInputValue("");
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "今";
    if (diffInHours < 24) return `${diffInHours}時間前`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "昨日";
    if (diffInDays < 7) return `${diffInDays}日前`;
    return past.toLocaleDateString('ja-JP');
  };

  return (
    <TooltipProvider>
      <div className="h-screen bg-[#0a0a0a] text-white flex overflow-hidden">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarOpen ? 260 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="relative flex-shrink-0 bg-[#171717] border-r border-[#2a2a2a] overflow-hidden"
        >
          <div className="flex flex-col h-full w-[260px]">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-[#2a2a2a]">
              <Button
                onClick={startNewChat}
                variant="ghost"
                className="flex items-center gap-2 text-white hover:bg-[#2a2a2a] flex-1 justify-start"
              >
                <PenSquare className="w-4 h-4" />
                新しいチャット
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(false)}
                className="text-white hover:bg-[#2a2a2a] md:hidden"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="space-y-1">
                {isLoadingHistory ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-10 bg-[#2a2a2a] rounded animate-pulse" />
                    ))}
                  </>
                ) : chatHistory.length > 0 ? (
                  chatHistory.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative"
                    >
                      <Button
                        variant="ghost"
                        className={`w-full justify-start text-left p-3 h-auto hover:bg-[#2a2a2a] ${
                          selectedSessionId === session.id ? 'bg-[#2a2a2a]' : ''
                        }`}
                        onClick={() => loadSession(session)}
                      >
                        <div className="flex items-start gap-2 w-full min-w-0">
                          <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {session.title}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {getTimeAgo(session.timestamp)}
                            </p>
                          </div>
                        </div>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-6 w-6 text-gray-400 hover:text-white hover:bg-[#3a3a3a]"
                        onClick={(e) => deleteSession(session.id, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">履歴がありません</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-[#2a2a2a] p-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
              >
                <Settings className="w-4 h-4 mr-2" />
                設定
              </Button>
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              {!isSidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(true)}
                  className="text-white hover:bg-[#2a2a2a]"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              <h1 className="text-xl font-semibold">オープンオペレーター</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <Bot className="w-4 h-4 mr-2" />
                API
              </Button>
            </div>
          </div>

          {/* Chat Area */}
          <AnimatePresence mode="wait">
            {!isChatVisible ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center p-8"
              >
                <div className="max-w-2xl w-full space-y-8">
                  {/* Welcome Message */}
                  <div className="text-center space-y-4">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="relative"
                    >
                      <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <Bot className="w-8 h-8 text-white" />
                      </div>
                    </motion.div>
                    <motion.h2
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="text-3xl font-bold text-white"
                    >
                      何をお手伝いしましょうか？
                    </motion.h2>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-gray-400"
                    >
                      AIエージェントがウェブを自動操作してタスクを実行します
                    </motion.p>
                  </div>

                  {/* Input Form */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <form onSubmit={handleSubmit} className="relative">
                      <div className="relative">
                        <Input
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder="メッセージを入力..."
                          className="w-full h-14 pr-12 text-base bg-[#2a2a2a] border-[#3a3a3a] focus:border-orange-500 text-white placeholder:text-gray-500 rounded-xl"
                        />
                        <Button
                          type="submit"
                          disabled={!inputValue.trim()}
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </form>
                  </motion.div>

                  {/* Quick Actions */}
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-3"
                  >
                    {[
                      {
                        title: "GitHub分析",
                        description: "リポジトリの貢献者を調査",
                        query: "BrowserbaseのStagehandの最大のGitHubコントリビューターは誰？",
                        icon: "🔍"
                      },
                      {
                        title: "株価情報",
                        description: "リアルタイム価格を取得",
                        query: "NVIDIAの株価はいくら？",
                        icon: "📈"
                      },
                      {
                        title: "スポーツ統計",
                        description: "チームの成績を確認",
                        query: "49ersの勝利数は？",
                        icon: "🏈"
                      },
                      {
                        title: "選手データ",
                        description: "パフォーマンス分析",
                        query: "ステフィン・カリーのPPGは？",
                        icon: "🏀"
                      }
                    ].map((item, index) => (
                      <Card
                        key={index}
                        className="bg-[#2a2a2a] border-[#3a3a3a] hover:border-orange-500/50 transition-all cursor-pointer group"
                        onClick={() => startChat(item.query)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{item.icon}</div>
                            <div>
                              <h3 className="font-medium text-white group-hover:text-orange-400 transition-colors">
                                {item.title}
                              </h3>
                              <p className="text-sm text-gray-400">{item.description}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <ChatFeed
                initialMessage={initialMessage}
                sessionId={selectedSessionId}
                onClose={() => {
                  setIsChatVisible(false);
                  fetchChatHistory();
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}
