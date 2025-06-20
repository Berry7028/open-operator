"use client";

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
  Sparkles,
  Brain
} from "./components/icons";

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
      <div className="h-screen relative overflow-hidden bg-[#222831]">
        <div className="relative z-10 h-full text-[#EEEEEE] flex overflow-hidden">
          {/* Sidebar */}
          <motion.aside
            initial={false}
            animate={{ width: isSidebarOpen ? 280 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative flex-shrink-0 overflow-hidden"
          >
            <div className="flex flex-col h-full w-[280px] bg-[#393E46] border-r border-[#495057]">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#495057]">
                <Button
                  onClick={startNewChat}
                  variant="ghost"
                  className="flex items-center gap-3 text-[#EEEEEE] hover:bg-[#495057] flex-1 justify-start bg-[#393E46] border border-[#495057] rounded-lg h-11 transition-all duration-200"
                >
                  <div className="w-5 h-5 rounded bg-[#00ADB5] flex items-center justify-center">
                    <PenSquare className="w-3 h-3 text-[#222831]" />
                  </div>
                  新しいチャット
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(false)}
                  className="text-[#EEEEEE] hover:bg-[#495057] md:hidden ml-2 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-2">
                  {isLoadingHistory ? (
                    <>
                      {[...Array(5)].map((_, i) => (
                        <motion.div 
                          key={i} 
                          className="h-14 bg-[#495057] rounded-lg animate-pulse"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                        />
                      ))}
                    </>
                  ) : chatHistory.length > 0 ? (
                    chatHistory.map((session, index) => (
                      <motion.div
                        key={session.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative"
                      >
                        <Button
                          variant="ghost"
                          className={`w-full justify-start text-left p-4 h-auto hover:bg-[#495057] transition-all duration-200 rounded-lg ${
                            selectedSessionId === session.id 
                              ? 'bg-[#495057] border border-[#6C757D]' 
                              : 'border border-transparent hover:border-[#6C757D]'
                          }`}
                          onClick={() => loadSession(session)}
                        >
                          <div className="flex items-start gap-3 w-full min-w-0">
                            <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
                              session.status === 'completed' 
                                ? 'bg-[#00ADB5]' 
                                : session.status === 'in-progress'
                                ? 'bg-[#CED4DA]'
                                : 'bg-[#ef4444]'
                            }`}>
                              <MessageSquare className={`w-4 h-4 ${
                                session.status === 'completed' ? 'text-[#222831]' : 'text-[#EEEEEE]'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#EEEEEE] truncate leading-snug">
                                {session.title}
                              </p>
                              <p className="text-xs text-[#CED4DA] truncate mt-1">
                                {getTimeAgo(session.timestamp)}
                              </p>
                            </div>
                          </div>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-7 w-7 text-[#CED4DA] hover:text-[#EEEEEE] hover:bg-[#495057] border border-transparent rounded transition-all duration-200"
                          onClick={(e) => deleteSession(session.id, e)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-[#CED4DA]">
                      <div className="w-12 h-12 rounded bg-[#495057] flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-6 h-6 opacity-50" />
                      </div>
                      <p className="text-sm">履歴がありません</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-[#495057] p-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-[#CED4DA] hover:text-[#EEEEEE] hover:bg-[#495057] rounded-lg h-11 transition-all duration-200"
                >
                  <Settings className="w-5 h-5 mr-3" />
                  設定
                </Button>
              </div>
            </div>
          </motion.aside>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 border-b border-[#495057] bg-[#393E46]">
              <div className="flex items-center gap-4">
                {!isSidebarOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen(true)}
                    className="text-[#EEEEEE] hover:bg-[#495057] rounded-lg h-10 w-10 transition-all duration-200"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#00ADB5] flex items-center justify-center">
                    <Bot className="w-5 h-5 text-[#222831]" />
                  </div>
                  <h1 className="text-xl font-semibold">
                    オープンオペレーター
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[#CED4DA] hover:text-[#EEEEEE] hover:bg-[#495057] rounded-lg transition-all duration-200"
                >
                  <Brain className="w-4 h-4 mr-2" />
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
                  <div className="max-w-3xl w-full space-y-10">
                    {/* Welcome Message */}
                    <div className="text-center space-y-6">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="relative"
                      >
                        <div className="relative w-20 h-20 bg-[#00ADB5] rounded-2xl mx-auto mb-6 flex items-center justify-center">
                          <Bot className="w-10 h-10 text-[#222831]" />
                        </div>
                      </motion.div>
                      <motion.h2
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-4xl font-bold"
                      >
                        何をお手伝いしましょうか？
                      </motion.h2>
                      <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-lg text-[#CED4DA] max-w-2xl mx-auto leading-relaxed"
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
                        <div className="relative group">
                          <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="メッセージを入力..."
                            className="w-full h-16 pr-16 text-lg bg-[#393E46] border border-[#495057] focus:border-[#00ADB5] text-[#EEEEEE] placeholder:text-[#CED4DA] rounded-xl transition-all duration-200"
                          />
                          <Button
                            type="submit"
                            disabled={!inputValue.trim()}
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 bg-[#00ADB5] hover:bg-[#009AA3] disabled:bg-[#6C757D] disabled:opacity-50 rounded-lg transition-all duration-200 text-[#222831]"
                          >
                            <Send className="w-5 h-5" />
                          </Button>
                        </div>
                      </form>
                    </motion.div>

                    {/* Quick Actions */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
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
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + index * 0.1 }}
                        >
                          <Card
                            className="bg-[#393E46] border border-[#495057] hover:border-[#00ADB5] transition-all duration-200 cursor-pointer group hover-lift"
                            onClick={() => startChat(item.query)}
                          >
                            <CardContent className="p-6">
                              <div className="flex items-center gap-4">
                                <div className="text-3xl">{item.icon}</div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-[#EEEEEE] text-lg">
                                    {item.title}
                                  </h3>
                                  <p className="text-sm text-[#CED4DA] mt-1 leading-relaxed">{item.description}</p>
                                </div>
                                <Sparkles className="w-5 h-5 text-[#CED4DA] opacity-0 group-hover:opacity-100 transition-all duration-200" />
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
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
      </div>
    </TooltipProvider>
  );
}
