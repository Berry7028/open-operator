import { NextResponse } from "next/server";
import { Browser, chromium } from "playwright";
import { v4 as uuidv4 } from "uuid";

// In-memory browser session storage (in production, use Redis or similar)
const activeBrowsers = new Map<string, Browser>();
const sessionTimeouts = new Map<string, NodeJS.Timeout>();
const debugPorts = new Map<string, number>();

// Get an available port for Chrome DevTools Protocol
function getAvailablePort(): number {
  // Start from 9222 (default Chrome debug port) and increment
  const basePort = 9222;
  const usedPorts = Array.from(debugPorts.values());
  let port = basePort;
  
  while (usedPorts.includes(port)) {
    port++;
  }
  
  return port;
}

async function createSession(timezone?: string, contextId?: string) {
  const sessionId = uuidv4();
  const debugPort = getAvailablePort();
  
  // Launch a new browser instance with CDP enabled
  const browser = await chromium.launch({
    headless: false, // Set to false to see browser window
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-default-apps',
      `--remote-debugging-port=${debugPort}`,
      '--remote-debugging-address=127.0.0.1',
    ],
  });

  // Store the browser instance and debug port
  activeBrowsers.set(sessionId, browser);
  debugPorts.set(sessionId, debugPort);

  // Set up auto-cleanup after 30 minutes of inactivity
  const timeout = setTimeout(async () => {
    await cleanupSession(sessionId);
  }, 30 * 60 * 1000); // 30 minutes

  sessionTimeouts.set(sessionId, timeout);

  console.log(`Created local browser session: ${sessionId} with debug port: ${debugPort}`);
  
  return {
    session: { id: sessionId },
    contextId: contextId || sessionId,
    debugPort,
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

  debugPorts.delete(sessionId);

  if (timeout) {
    clearTimeout(timeout);
    sessionTimeouts.delete(sessionId);
  }
}

async function endSession(sessionId: string) {
  await cleanupSession(sessionId);
}

function getSessionUrl(sessionId: string) {
  const debugPort = debugPorts.get(sessionId);
  if (debugPort) {
    // Return Chrome DevTools URL for the browser instance
    return `http://127.0.0.1:${debugPort}`;
  }
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
    
    const { session, contextId, debugPort } = await createSession(
      timezone,
      providedContextId
    );
    
    const sessionUrl = getSessionUrl(session.id);
    
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionUrl,
      contextId,
      debugPort,
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId parameter" },
        { status: 400 }
      );
    }

    const debugPort = debugPorts.get(sessionId);
    if (!debugPort) {
      return NextResponse.json(
        { error: "Session not found or no debug port available" },
        { status: 404 }
      );
    }

    try {
      // Get list of available tabs from Chrome DevTools Protocol
      const response = await fetch(`http://127.0.0.1:${debugPort}/json`);
      const tabs = await response.json();
      
      // Find the main tab (usually the first one)
      const mainTab = tabs.find((tab: any) => tab.type === 'page');
      
      if (mainTab) {
        return NextResponse.json({
          success: true,
          debugUrl: `http://127.0.0.1:${debugPort}`,
          inspectorUrl: `http://127.0.0.1:${debugPort}/devtools/inspector.html?ws=${mainTab.webSocketDebuggerUrl.replace('ws://', '')}`,
          tabs,
        });
      } else {
        return NextResponse.json({
          success: true,
          debugUrl: `http://127.0.0.1:${debugPort}`,
          inspectorUrl: null,
          tabs,
        });
      }
    } catch (error) {
      console.error('Error fetching DevTools info:', error);
      return NextResponse.json({
        success: true,
        debugUrl: `http://127.0.0.1:${debugPort}`,
        inspectorUrl: null,
        tabs: [],
      });
    }
  } catch (error) {
    console.error("Error getting session info:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get session info" },
      { status: 500 }
    );
  }
}
