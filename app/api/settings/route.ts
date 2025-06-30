import { NextResponse } from "next/server";
import { setSessionApiKey, getSessionKeys } from "../../lib/session-utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { providers } = body;

    // Store API keys in session
    Object.keys(providers).forEach(providerId => {
      const provider = providers[providerId];
      if (provider?.enabled && provider?.apiKey) {
        setSessionApiKey(`${providerId.toUpperCase()}_API_KEY`, provider.apiKey);
        if (provider.baseUrl) {
          setSessionApiKey(`${providerId.toUpperCase()}_BASE_URL`, provider.baseUrl);
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
    sessionKeys: getSessionKeys(),
  });
}