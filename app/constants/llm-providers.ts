import { LLMProvider } from '../types';

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    requiresApiKey: true,
    apiKeyLabel: 'OpenAI API Key',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxTokens: 128000, supportsVision: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxTokens: 128000, supportsVision: true },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', maxTokens: 128000, supportsVision: true },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', maxTokens: 16385 },
      { id: 'o3-mini', name: 'o3 Mini', provider: 'openai', maxTokens: 128000, supportsTools: true },
      { id: 'o1-preview', name: 'o1 Preview', provider: 'openai', maxTokens: 128000 },
      { id: 'o1-mini', name: 'o1 Mini', provider: 'openai', maxTokens: 65536 },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    requiresApiKey: true,
    apiKeyLabel: 'Anthropic API Key',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', maxTokens: 200000, supportsVision: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', maxTokens: 200000, supportsVision: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', maxTokens: 200000, supportsVision: true },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    requiresApiKey: true,
    apiKeyLabel: 'Google AI API Key',
    models: [
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google', maxTokens: 1000000, supportsVision: true },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'google', maxTokens: 1000000, supportsVision: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', maxTokens: 2000000, supportsVision: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', maxTokens: 1000000, supportsVision: true },
      { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking', provider: 'google', maxTokens: 1000000, supportsVision: true, supportsDeepThink: true },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    requiresApiKey: true,
    apiKeyLabel: 'OpenRouter API Key',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { 
        id: 'minimax/minimax-m1:extended', 
        name: 'MiniMax M1 Extended', 
        provider: 'openrouter', 
        maxTokens: 1000000, 
        supportsVision: true,
        supportsTools: true,
        specialization: 'Advanced reasoning and multi-modal capabilities'
      },
    ],
  },
];

export const DEFAULT_MODEL = 'claude-3-5-haiku-20241022';