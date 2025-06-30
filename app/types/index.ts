export interface LLMProvider {
  id: string;
  name: string;
  models: LLMModel[];
  requiresApiKey: boolean;
  apiKeyLabel: string;
  baseUrl?: string;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  maxTokens?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsAudio?: boolean;
  supportsDeepThink?: boolean;
  specialization?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  selectedTools: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant" | "system";
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    cost?: number;
  };
}

export interface AppSettings {
  providers: Record<string, {
    apiKey: string;
    baseUrl?: string;
    enabled: boolean;
  }>;
  defaultModel: string;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  defaultTools: string[];
  language: 'ja' | 'en';
}

export interface BrowserStep {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK" | "CALL_TOOL";
  instruction: string;
  stepNumber?: number;
  toolResult?: unknown;
}

export interface ToolSelection {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
}