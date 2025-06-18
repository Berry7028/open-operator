"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChatFeed from "./components/ChatFeed";
import AnimatedButton from "./components/AnimatedButton";
import Image from "next/image";
import posthog from "posthog-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";
import { Github, Globe, Search, TrendingUp, Users, Zap, Sparkles, ArrowRight, Brain, Bot, Cpu } from "lucide-react";

export default function Home() {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle CMD+Enter to submit the form when chat is not visible
      if (!isChatVisible && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        const form = document.querySelector("form") as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }

      // Handle CMD+K to focus input when chat is not visible
      if (!isChatVisible && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector(
          'input[name="message"]'
        ) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }

      // Handle ESC to close chat when visible
      if (isChatVisible && e.key === "Escape") {
        e.preventDefault();
        setIsChatVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChatVisible]);

  const startChat = useCallback(
    (finalMessage: string) => {
      setInitialMessage(finalMessage);
      setIsChatVisible(true);

      try {
        posthog.capture("submit_message", {
          message: finalMessage,
        });
      } catch (e) {
        console.error(e);
      }
    },
    [setInitialMessage, setIsChatVisible]
  );

  return (
    <TooltipProvider>
      <AnimatePresence mode="wait">
        {!isChatVisible ? (
          <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-radial from-orange-900/20 via-black to-black animate-pulse-glow" />
            
            {/* Grid pattern overlay */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=&quot;60&quot; height=&quot;60&quot; viewBox=&quot;0 0 60 60&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;none&quot; fill-rule=&quot;evenodd&quot;%3E%3Cg fill=&quot;%239C92AC&quot; fill-opacity=&quot;0.05&quot;%3E%3Cpath d=&quot;M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z&quot;/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20" />

            {/* Top Navigation */}
            <nav className="relative z-50 flex justify-between items-center px-8 py-6 border-b border-zinc-800/50 backdrop-blur-xl bg-black/50">
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
                  <p className="text-xs text-zinc-500 font-ppsupply">AI-Powered Web Automation</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                  <Bot className="w-4 h-4 mr-2" />
                  API
                </Button>
                <Button variant="github" asChild>
                  <a
                    href="https://github.com/browserbase/open-operator"
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    GitHub
                  </a>
                </Button>
              </div>
            </nav>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-[720px] text-center mb-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 mb-6"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm text-zinc-400">Powered by AI</span>
                </motion.div>
                
                <h1 className="text-5xl md:text-6xl font-ppneue mb-4">
                  <span className="gradient-text">AIがウェブを</span>
                  <br />
                  <span className="text-white">自動操作します</span>
                </h1>
                
                <p className="text-lg text-zinc-400 font-ppsupply max-w-md mx-auto">
                  検索、データ収集、タスクの自動化。AIエージェントがあなたの代わりにウェブを操作します。
                </p>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="w-full max-w-[640px]"
              >
                <Card className="glass-dark border-zinc-800/50 shadow-2xl">
                  <div className="w-full h-10 bg-zinc-900/50 border-b border-zinc-800/50 flex items-center px-4 rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-all cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-800">
                          <p>Close</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-all cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-800">
                          <p>Minimize</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-3 h-3 rounded-full bg-green-500/80 hover:bg-green-500 transition-all cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-zinc-900 border-zinc-800">
                          <p>Maximize</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Brain className="w-3 h-3 text-primary animate-pulse" />
                      <span className="text-xs text-zinc-500 font-ppsupply">AI Browser</span>
                    </div>
                  </div>

                  <CardContent className="p-8 space-y-6">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const input = e.currentTarget.querySelector(
                          'input[name="message"]'
                        ) as HTMLInputElement;
                        const message = (formData.get("message") as string).trim();
                        const finalMessage = message || input.placeholder;
                        startChat(finalMessage);
                      }}
                      className="w-full"
                    >
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-orange-600/20 rounded-lg blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
                        <div className="relative flex items-center">
                          <Search className="absolute left-4 text-zinc-500 w-5 h-5" />
                          <Input
                            name="message"
                            type="text"
                            placeholder="何を調べましょうか？"
                            className="pl-12 pr-28 h-14 text-base font-ppsupply bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 focus:border-primary text-white placeholder:text-zinc-500"
                          />
                          <div className="absolute right-2">
                            <Button variant="glow" className="font-ppsupply">
                              実行
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </form>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <Zap className="w-4 h-4" />
                        <p className="text-sm font-ppsupply">クイックアクション</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            icon: <Users className="w-5 h-5" />,
                            title: "GitHub貢献者",
                            description: "最大の貢献者を検索",
                            query: "BrowserbaseのStagehandの最大のGitHubコントリビューターは誰？",
                            color: "from-blue-500/20 to-purple-500/20"
                          },
                          {
                            icon: <TrendingUp className="w-5 h-5" />,
                            title: "スポーツ統計",
                            description: "チームの成績を確認",
                            query: "49ersの勝利数は？",
                            color: "from-green-500/20 to-emerald-500/20"
                          },
                          {
                            icon: <Cpu className="w-5 h-5" />,
                            title: "選手データ",
                            description: "パフォーマンス分析",
                            query: "ステフィン・カリーのPPGは？",
                            color: "from-purple-500/20 to-pink-500/20"
                          },
                          {
                            icon: <TrendingUp className="w-5 h-5" />,
                            title: "株価情報",
                            description: "リアルタイム価格",
                            query: "NVIDIAの株価はいくら？",
                            color: "from-orange-500/20 to-red-500/20"
                          }
                        ].map((item, index) => (
                          <motion.div
                            key={index}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <Button
                              variant="outline"
                              className="w-full h-auto p-4 justify-start text-left bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/50 group relative overflow-hidden"
                              onClick={() => startChat(item.query)}
                            >
                              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                              <div className="relative space-y-2">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-zinc-800/50 text-primary">
                                    {item.icon}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-white">{item.title}</p>
                                    <p className="text-xs text-zinc-500">{item.description}</p>
                                  </div>
                                </div>
                              </div>
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-12 flex items-center gap-6 text-sm text-zinc-500"
              >
                <a
                  href="https://stagehand.dev"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    🤘
                  </div>
                  <span className="font-ppsupply">Stagehand</span>
                </a>
                <span className="text-zinc-700">×</span>
                <a
                  href="https://browserbase.com"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    🅱️
                  </div>
                  <span className="font-ppsupply">Browserbase</span>
                </a>
              </motion.div>
            </main>
          </div>
        ) : (
          <ChatFeed
            initialMessage={initialMessage}
            onClose={() => setIsChatVisible(false)}
          />
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
