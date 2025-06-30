import { NextResponse } from "next/server";
import { getSessionApiKey } from "../../lib/session-utils";

export async function GET() {
  try {
    const models = [];

    // OpenAI models
    const openaiKey = getSessionApiKey('OPENAI_API_KEY');
    if (openaiKey) {
      try {
        const openaiModels = [
          { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', maxTokens: 128000, supportsVision: true },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', maxTokens: 128000, supportsVision: true },
          { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', maxTokens: 128000, supportsVision: true },
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', maxTokens: 16385 },
          { id: 'o1-preview', name: 'o1 Preview', provider: 'openai', maxTokens: 128000 },
          { id: 'o1-mini', name: 'o1 Mini', provider: 'openai', maxTokens: 65536 },
        ];
        models.push(...openaiModels);
      } catch (error) {
        console.error('Failed to fetch OpenAI models:', error);
      }
    }

    // Anthropic models
    const anthropicKey = getSessionApiKey('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      try {
        const anthropicModels = [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', maxTokens: 200000, supportsVision: true },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic', maxTokens: 200000, supportsVision: true },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', maxTokens: 200000, supportsVision: true },
        ];
        models.push(...anthropicModels);
      } catch (error) {
        console.error('Failed to fetch Anthropic models:', error);
      }
    }

    // Google models
    const googleKey = getSessionApiKey('GOOGLE_AI_API_KEY');
    if (googleKey) {
      try {
        const googleModels = [
          { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'google', maxTokens: 1000000, supportsVision: true },
          { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', maxTokens: 2000000, supportsVision: true },
          { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', maxTokens: 1000000, supportsVision: true },
        ];
        models.push(...googleModels);
      } catch (error) {
        console.error('Failed to fetch Google models:', error);
      }
    }

    return NextResponse.json({
      success: true,
      models,
      providers: {
        openai: { enabled: !!openaiKey, name: 'OpenAI' },
        anthropic: { enabled: !!anthropicKey, name: 'Anthropic' },
        google: { enabled: !!googleKey, name: 'Google' },
      }
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch models' },
      { status: 500 }
    );
  }
}