"use client";

import { LLM_PROVIDERS } from "@/app/constants/llm-providers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
  SelectGroup,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  enabledProviders: string[];
}

export function ModelSelector({
  selectedModel,
  onModelChange,
  enabledProviders,
}: ModelSelectorProps) {
  const availableModels = LLM_PROVIDERS
    .filter(provider => enabledProviders.includes(provider.id))
    .flatMap(provider => provider.models);

  const selectedModelInfo = availableModels.find(model => model.id === selectedModel);

  if (availableModels.length === 0) {
    return (
      <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
        <p className="text-sm text-destructive font-ppsupply">
          No models available. Please configure API keys in settings.
        </p>
      </div>
    );
  }

  return (
    <Select value={selectedModel} onValueChange={onModelChange}>
      <SelectTrigger className="font-ppsupply">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <SelectValue>
            {selectedModelInfo ? selectedModelInfo.name : 'Select Model'}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {LLM_PROVIDERS.map(provider => {
          if (!enabledProviders.includes(provider.id)) return null;
          
          return (
            <SelectGroup key={provider.id}>
              <SelectLabel className="font-ppsupply">{provider.name}</SelectLabel>
              {provider.models.map(model => (
                <SelectItem key={model.id} value={model.id} className="font-ppsupply">
                  <div className="flex items-center justify-between w-full">
                    <span>{model.name}</span>
                    <div className="flex gap-1 ml-2">
                      {model.supportsVision && (
                        <Badge variant="secondary" className="text-xs">
                          Vision
                        </Badge>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}