import { NextResponse } from "next/server";

// Session storage for API keys (in production, use secure session storage)
const sessionApiKeys: Record<string, string> = {};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { providers } = body;

    // Store API keys in session
    Object.keys(providers).forEach(providerId => {
      const provider = providers[providerId];
      if (provider?.enabled && provider?.apiKey) {
        sessionApiKeys[`${providerId.toUpperCase()}_API_KEY`] = provider.apiKey;
        if (provider.baseUrl) {
          sessionApiKeys[`${providerId.toUpperCase()}_BASE_URL`] = provider.baseUrl;
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    sessionKeys: Object.keys(sessionApiKeys),
  });
}

// Helper function to get session API key
export function getSessionApiKey(keyName: string): string | undefined {
  return sessionApiKeys[keyName] || process.env[keyName];
}