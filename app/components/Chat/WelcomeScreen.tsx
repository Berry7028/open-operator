"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import ModelSelector from "./ModelSelector";
import Image from "next/image";

interface WelcomeScreenProps {
  onStartChat: (message: string, model: string) => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  enabledProviders: string[];
}

const EXAMPLE_PROMPTS = [
  "What's the current price of NVIDIA stock?",
  "Who is the top GitHub contributor to Stagehand by Browserbase?",
  "How many wins do the 49ers have this season?",
  "What is Stephen Curry's points per game average?",
  "Find the latest news about AI developments",
  "Search for the best restaurants in San Francisco",
];

export default function WelcomeScreen({
  onStartChat,
  selectedModel,
  onModelChange,
  enabledProviders,
}: WelcomeScreenProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if (message) {
      onStartChat(message, selectedModel);
      setInput("");
    }
  };

  const handleExampleClick = (prompt: string) => {
    onStartChat(prompt, selectedModel);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-900">
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
            <h1 className="text-3xl font-ppneue text-gray-100">Open Operator</h1>
          </div>
          <p className="text-lg text-gray-400 font-ppsupply">
            Watch AI browse the web and complete tasks for you
          </p>
        </div>

        {/* Model Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2 font-ppsupply">
            Select Model
          </label>
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            enabledProviders={enabledProviders}
          />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What would you like me to help you with?"
              className="w-full px-4 py-4 pr-16 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-ppsupply text-lg text-gray-100 placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="absolute right-2 top-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-ppsupply"
            >
              Start
            </button>
          </div>
        </form>

        {/* Example Prompts */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3 font-ppsupply">
            Try these examples:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EXAMPLE_PROMPTS.map((prompt, index) => (
              <motion.button
                key={index}
                onClick={() => handleExampleClick(prompt)}
                className="text-left p-3 bg-gray-800 border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-gray-750 transition-colors font-ppsupply"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-sm text-gray-300">{prompt}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-500 font-ppsupply">
          Powered by{" "}
          <a
            href="https://stagehand.dev"
            className="text-yellow-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            🤘 Stagehand
          </a>{" "}
          on{" "}
          <a
            href="https://browserbase.com"
            className="text-orange-400 hover:underline"
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