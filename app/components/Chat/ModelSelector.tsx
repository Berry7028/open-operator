"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { LLM_PROVIDERS } from "../../constants/llm-providers";
import { LLMModel } from "../../types";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  enabledProviders: string[];
}

export default function ModelSelector({
  selectedModel,
  onModelChange,
  enabledProviders,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const availableModels = LLM_PROVIDERS
    .filter(provider => enabledProviders.includes(provider.id))
    .flatMap(provider => provider.models);

  const selectedModelInfo = availableModels.find(model => model.id === selectedModel);

  if (availableModels.length === 0) {
    return (
      <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-sm text-yellow-800 font-ppsupply">
          No models available. Please configure API keys in settings.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-ppsupply"
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm">
            {selectedModelInfo ? selectedModelInfo.name : 'Select Model'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto"
        >
          {LLM_PROVIDERS.map(provider => {
            if (!enabledProviders.includes(provider.id)) return null;
            
            return (
              <div key={provider.id}>
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-600 font-ppsupply">
                    {provider.name}
                  </span>
                </div>
                {provider.models.map(model => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors font-ppsupply ${
                      selectedModel === model.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{model.name}</span>
                      {model.supportsVision && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          Vision
                        </span>
                      )}
                    </div>
                    {model.maxTokens && (
                      <div className="text-xs text-gray-500 mt-1">
                        Max tokens: {model.maxTokens.toLocaleString()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}