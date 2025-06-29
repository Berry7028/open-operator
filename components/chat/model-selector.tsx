"use client";

import { useModels } from "@/app/hooks/useModels";
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
import { Loader2 } from "lucide-react";

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({
  selectedModel,
  onModelChange,
}: ModelSelectorProps) {
  const { models, providers, isLoading, error, getModelsByProvider } = useModels();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground font-ppsupply">
          Loading models...
        </span>
      </div>
    );
  }

  if (error || models.length === 0) {
    return (
      <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
        <p className="text-sm text-destructive font-ppsupply">
          {error || 'No models available. Please configure API keys.'}
        </p>
      </div>
    );
  }

  const modelsByProvider = getModelsByProvider();
  const selectedModelInfo = models.find(model => model.id === selectedModel);

  return (
    <Select value={selectedModel} onValueChange={onModelChange}>
      <SelectTrigger className="font-ppsupply bg-card border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <SelectValue>
            {selectedModelInfo ? selectedModelInfo.name : 'Select Model'}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="bg-card border-border">
        {Object.entries(modelsByProvider).map(([providerId, providerModels]) => {
          const providerInfo = providers[providerId];
          if (!providerInfo?.enabled) return null;
          
          return (
            <SelectGroup key={providerId}>
              <SelectLabel className="font-ppsupply text-muted-foreground">
                {providerInfo.name}
              </SelectLabel>
              {providerModels.map(model => (
                <SelectItem 
                  key={model.id} 
                  value={model.id} 
                  className="font-ppsupply hover:bg-accent focus:bg-accent"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{model.name}</span>
                    <div className="flex gap-1 ml-2">
                      {model.supportsVision && (
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                          Vision
                        </Badge>
                      )}
                      {model.maxTokens && (
                        <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                          {(model.maxTokens / 1000).toFixed(0)}K
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