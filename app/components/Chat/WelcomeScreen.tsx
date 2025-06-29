"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ModelSelector } from "@/components/chat/model-selector";
import { ToolSelector } from "@/components/chat/tool-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useModels } from "@/app/hooks/useModels";
import Image from "next/image";

interface WelcomeScreenProps {
  onStartChat: (message: string, model: string, selectedTools: string[]) => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

const EXAMPLE_PROMPTS = [
  "Create a todo list for my project tasks",
  "Generate a Python script to analyze data",
  "What's the current time in Tokyo?",
  "Calculate the compound interest for $1000 at 5% for 10 years",
  "Search for the latest AI developments",
  "Create a folder structure for a new web project",
];

export default function WelcomeScreen({
  onStartChat,
  selectedModel,
  onModelChange,
}: WelcomeScreenProps) {
  const [input, setInput] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const { models } = useModels();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (message && selectedModel) {
      onStartChat(message, selectedModel, selectedTools);
      setInput("");
    }
  };

  const handleExampleClick = (prompt: string) => {
    if (selectedModel) {
      onStartChat(prompt, selectedModel, selectedTools);
    }
  };

  // Set default model if none selected and models are available
  if (!selectedModel && models.length > 0) {
    onModelChange(models[0].id);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background">
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Image
              src="/favicon.svg"
              alt="Open Operator"
              className="w-12 h-12"
              width={48}
              height={48}
            />
            <h1 className="text-3xl font-ppneue text-foreground">Open Operator</h1>
          </div>
          <p className="text-lg text-muted-foreground font-ppsupply">
            AI Agent with powerful tools for web browsing, programming, and productivity
          </p>
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <Label className="font-ppsupply text-foreground">Select Model</Label>
          <div className="mt-2">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={onModelChange}
            />
          </div>
        </div>

        {/* Tool Selection */}
        <div className="mb-6">
          <Label className="font-ppsupply text-foreground">Select Tools</Label>
          <div className="mt-2">
            <ToolSelector
              selectedTools={selectedTools}
              onToolsChange={setSelectedTools}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-ppsupply">
            Choose which tools the agent can use. Leave empty to allow all tools.
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative">
            <Input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What would you like me to help you with?"
              className="pr-16 h-12 font-ppsupply text-base bg-input border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              disabled={!input.trim() || !selectedModel}
              className="absolute right-2 top-2 h-8 font-ppsupply bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Start
            </Button>
          </div>
        </form>

        {/* Example Prompts */}
        <div>
          <h3 className="text-sm font-medium mb-3 font-ppsupply text-foreground">
            Try these examples:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EXAMPLE_PROMPTS.map((prompt, index) => (
              <motion.div key={index} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card 
                  className="cursor-pointer hover:bg-accent transition-colors bg-card border-border"
                  onClick={() => handleExampleClick(prompt)}
                >
                  <CardContent className="p-3">
                    <span className="text-sm font-ppsupply text-card-foreground">{prompt}</span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground font-ppsupply">
          Powered by{" "}
          <a
            href="https://stagehand.dev"
            className="text-foreground hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            🤘 Stagehand
          </a>{" "}
          on{" "}
          <a
            href="https://browserbase.com"
            className="text-foreground hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            🅱️ Browserbase
          </a>
        </div>
      </motion.div>
    </div>
  );
}