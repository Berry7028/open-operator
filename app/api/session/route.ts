import { NextResponse } from "next/server";
import { Browser, chromium } from "playwright";
import { v4 as uuidv4 } from "uuid";

// In-memory browser session storage (in production, use Redis or similar)
const activeBrowsers = new Map<string, Browser>();
const sessionTimeouts = new Map<string, NodeJS.Timeout>();

async function createSession(timezone?: string, contextId?: string) {
  const sessionId = uuidv4();
  
  // Launch a new browser instance
  const browser = await chromium.launch({
    headless: false, // Set to false to see browser window
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-default-apps',
    ],
  });

  // Store the browser instance
  activeBrowsers.set(sessionId, browser);

  // Set up auto-cleanup after 30 minutes of inactivity
  const timeout = setTimeout(async () => {
    await cleanupSession(sessionId);
  }, 30 * 60 * 1000); // 30 minutes

  sessionTimeouts.set(sessionId, timeout);

  console.log(`Created local browser session: ${sessionId}`);
  
  return {
    session: { id: sessionId },
    contextId: contextId || sessionId,
  };
}

async function cleanupSession(sessionId: string) {
  const browser = activeBrowsers.get(sessionId);
  const timeout = sessionTimeouts.get(sessionId);

  if (browser) {
    try {
      await browser.close();
      console.log(`Closed browser session: ${sessionId}`);
    } catch (error) {
      console.error(`Error closing browser session ${sessionId}:`, error);
    }
    activeBrowsers.delete(sessionId);
  }

  if (timeout) {
    clearTimeout(timeout);
    sessionTimeouts.delete(sessionId);
  }
}

async function endSession(sessionId: string) {
  await cleanupSession(sessionId);
}

function getSessionUrl(sessionId: string) {
  // For local browser, we can't provide a debug URL like Browserbase
  // Instead, we'll return a placeholder that indicates it's running locally
  return `local://browser-session/${sessionId}`;
}

export function getBrowser(sessionId: string): Browser | undefined {
  return activeBrowsers.get(sessionId);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const timezone = body.timezone as string;
    const providedContextId = body.contextId as string;
    
    const { session, contextId } = await createSession(
      timezone,
      providedContextId
    );
    
    const sessionUrl = getSessionUrl(session.id);
    
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionUrl,
      contextId,
    });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create session" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body.sessionId as string;
    await endSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error ending session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to end session" },
      { status: 500 }
    );
  }
}
