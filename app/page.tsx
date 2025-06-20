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
      <div className="h-screen relative overflow-hidden">
        {/* アニメーション背景 */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950/30 via-transparent to-cyan-950/30" />
          {/* 動的光効果 */}
          <motion.div
            animate={{
              background: [
                "radial-gradient(800px circle at 0% 0%, rgb(168, 85, 247, 0.1) 0%, transparent 50%)",
                "radial-gradient(800px circle at 100% 100%, rgb(139, 92, 246, 0.1) 0%, transparent 50%)",
                "radial-gradient(800px circle at 0% 100%, rgb(236, 72, 153, 0.1) 0%, transparent 50%)",
                "radial-gradient(800px circle at 100% 0%, rgb(79, 70, 229, 0.1) 0%, transparent 50%)",
              ]
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: "linear"
            }}
            className="absolute inset-0"
          />
        </div>

        <div className="relative z-10 h-full text-white flex overflow-hidden">
          {/* Sidebar */}
          <motion.aside
            initial={false}
            animate={{ width: isSidebarOpen ? 280 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative flex-shrink-0 overflow-hidden"
          >
            <div className="flex flex-col h-full w-[280px] backdrop-blur-xl bg-white/[0.02] border-r border-white/10">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <Button
                  onClick={startNewChat}
                  variant="ghost"
                  className="flex items-center gap-3 text-white hover:bg-white/10 flex-1 justify-start bg-white/5 border border-white/10 rounded-xl h-11 transition-all duration-300 hover:scale-[1.02] hover:border-white/20"
                >
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <PenSquare className="w-3 h-3 text-white" />
                  </div>
                  新しいチャット
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsSidebarOpen(false)}
                  className="text-white hover:bg-white/10 md:hidden ml-2 rounded-xl"
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
                          className="h-14 bg-white/5 rounded-xl animate-pulse backdrop-blur-sm"
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
                          className={`w-full justify-start text-left p-4 h-auto hover:bg-white/10 transition-all duration-300 rounded-xl backdrop-blur-sm ${
                            selectedSessionId === session.id 
                              ? 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30' 
                              : 'hover:scale-[1.02] border border-transparent hover:border-white/10'
                          }`}
                          onClick={() => loadSession(session)}
                        >
                          <div className="flex items-start gap-3 w-full min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              session.status === 'completed' 
                                ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                                : session.status === 'in-progress'
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                : 'bg-gradient-to-br from-red-500 to-pink-600'
                            }`}>
                              <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate leading-snug">
                                {session.title}
                              </p>
                              <p className="text-xs text-gray-400 truncate mt-1">
                                {getTimeAgo(session.timestamp)}
                              </p>
                            </div>
                          </div>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 h-7 w-7 text-gray-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/30 border border-transparent rounded-lg transition-all duration-300"
                          onClick={(e) => deleteSession(session.id, e)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
                        <MessageSquare className="w-6 h-6 opacity-50" />
                      </div>
                      <p className="text-sm">履歴がありません</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-white/10 p-3">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-400 hover:text-white hover:bg-white/10 rounded-xl h-11 transition-all duration-300"
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
            <div className="flex items-center justify-between p-4 border-b border-white/10 backdrop-blur-xl bg-white/[0.02]">
              <div className="flex items-center gap-4">
                {!isSidebarOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen(true)}
                    className="text-white hover:bg-white/10 rounded-xl h-10 w-10 transition-all duration-300 hover:scale-105"
                  >
                    <Menu className="w-5 h-5" />
                  </Button>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    オープンオペレーター
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300"
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
                        <motion.div
                          animate={{ 
                            rotate: [0, 360],
                          }}
                          transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear"
                          }}
                          className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 opacity-20 blur-lg"
                        />
                        <div className="relative w-20 h-20 bg-gradient-to-br from-violet-500 via-purple-500 to-pink-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-purple-500/25">
                          <Bot className="w-10 h-10 text-white" />
                          <motion.div
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 0.8, 0.5]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                            }}
                            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 opacity-30"
                          />
                        </div>
                      </motion.div>
                      <motion.h2
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-violet-200 bg-clip-text text-transparent"
                      >
                        何をお手伝いしましょうか？
                      </motion.h2>
                      <motion.p
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed"
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
                            className="w-full h-16 pr-16 text-lg bg-white/5 backdrop-blur-xl border border-white/20 focus:border-violet-500/50 text-white placeholder:text-gray-400 rounded-2xl transition-all duration-300 focus:shadow-lg focus:shadow-violet-500/25 group-hover:border-white/30"
                          />
                          <Button
                            type="submit"
                            disabled={!inputValue.trim()}
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 rounded-xl transition-all duration-300 hover:scale-105 disabled:hover:scale-100 shadow-lg"
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
                          icon: "🔍",
                          gradient: "from-emerald-500/20 to-green-500/10"
                        },
                        {
                          title: "株価情報",
                          description: "リアルタイム価格を取得",
                          query: "NVIDIAの株価はいくら？",
                          icon: "📈",
                          gradient: "from-blue-500/20 to-cyan-500/10"
                        },
                        {
                          title: "スポーツ統計",
                          description: "チームの成績を確認",
                          query: "49ersの勝利数は？",
                          icon: "🏈",
                          gradient: "from-orange-500/20 to-red-500/10"
                        },
                        {
                          title: "選手データ",
                          description: "パフォーマンス分析",
                          query: "ステフィン・カリーのPPGは？",
                          icon: "🏀",
                          gradient: "from-purple-500/20 to-pink-500/10"
                        }
                      ].map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + index * 0.1 }}
                        >
                          <Card
                            className={`bg-gradient-to-br ${item.gradient} backdrop-blur-xl border border-white/10 hover:border-white/30 transition-all duration-300 cursor-pointer group hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/10`}
                            onClick={() => startChat(item.query)}
                          >
                            <CardContent className="p-6">
                              <div className="flex items-center gap-4">
                                <div className="text-3xl filter drop-shadow-sm">{item.icon}</div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-white group-hover:text-violet-200 transition-colors text-lg">
                                    {item.title}
                                  </h3>
                                  <p className="text-sm text-gray-300 mt-1 leading-relaxed">{item.description}</p>
                                </div>
                                <Sparkles className="w-5 h-5 text-violet-400 opacity-0 group-hover:opacity-100 transition-all duration-300" />
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
