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
      <div className="chat-container h-screen flex">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarOpen ? 280 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="chat-sidebar flex-shrink-0 overflow-hidden"
        >
          <div className="flex flex-col h-full w-[280px]">
            {/* Header */}
            <div className="p-4 border-b border-[#525252]">
              <Button
                onClick={startNewChat}
                className="sidebar-new-chat w-full flex items-center gap-3 justify-start"
              >
                <Plus className="w-4 h-4" />
                新しいチャット
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
                        className="h-12 bg-[#525252] rounded-lg animate-pulse"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      />
                    ))}
                  </>
                ) : (
                  chatHistory.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`sidebar-chat-item cursor-pointer group relative ${selectedSessionId === session.id ? 'active' : ''}`}
                      onClick={() => loadSession(session)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {session.title}
                          </p>
                          <p className="text-xs opacity-70 mt-1">
                            {getTimeAgo(session.timestamp)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 text-gray-400 hover:text-red-400"
                          onClick={(e) => deleteSession(session.id, e)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Sidebar Toggle for mobile */}
            <div className="p-3 border-t border-[#525252] md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(false)}
                className="w-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col relative">
          {/* Mobile header */}
          <div className="md:hidden flex items-center p-4 border-b border-[#525252]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              className="mr-3"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">オープンオペレーター</h1>
          </div>

          {/* Chat or Welcome */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {isChatVisible ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="h-full"
                >
                  <ChatFeed
                    initialMessage={initialMessage}
                    onClose={() => setIsChatVisible(false)}
                    sessionId={selectedSessionId}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="welcome-container p-8"
                >
                  <div className="max-w-4xl mx-auto text-center">
                    {/* Welcome content */}
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.6 }}
                      className="mb-8"
                    >
                      <h1 className="welcome-title">
                        オープンオペレーター
                      </h1>
                      <p className="welcome-subtitle">
                        AIがウェブを閲覧する様子を無料で見る
                      </p>
                    </motion.div>

                    {/* Input form */}
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.6 }}
                      className="mb-8"
                    >
                      <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-2xl mx-auto">
                        <div className="flex-1 relative">
                          <Input
                            type="text"
                            placeholder="AIに何をしてもらいたいですか？"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className="welcome-input pr-12"
                          />
                        </div>
                        <Button
                          type="submit"
                          disabled={!inputValue.trim()}
                          className="chat-send-button"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </form>
                    </motion.div>

                    {/* Example prompts */}
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.6 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto"
                    >
                      {[
                        "最新のニュースを調べて",
                        "天気予報を確認して",
                        "レシピを検索して",
                        "株価をチェックして",
                        "おすすめの映画を探して",
                        "旅行先を調べて"
                      ].map((example, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
                        >
                          <Card 
                            className="card-minimal cursor-pointer p-4 hover:scale-105 transition-transform"
                            onClick={() => setInputValue(example)}
                          >
                            <CardContent className="p-0">
                              <p className="text-sm">{example}</p>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
