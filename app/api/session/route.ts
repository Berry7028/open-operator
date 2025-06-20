import { NextResponse } from "next/server";
import Browserbase from "@browserbasehq/sdk";

type BrowserbaseRegion =
  | "us-west-2"
  | "us-east-1"
  | "eu-central-1"
  | "ap-southeast-1";

// Exact timezone matches for east coast cities
const exactTimezoneMap: Record<string, BrowserbaseRegion> = {
  "America/New_York": "us-east-1",
  "America/Detroit": "us-east-1",
  "America/Toronto": "us-east-1",
  "America/Montreal": "us-east-1",
  "America/Boston": "us-east-1",
  "America/Chicago": "us-east-1",
};

// Prefix-based region mapping
const prefixToRegion: Record<string, BrowserbaseRegion> = {
  America: "us-west-2",
  US: "us-west-2",
  Canada: "us-west-2",
  Europe: "eu-central-1",
  Africa: "eu-central-1",
  Asia: "ap-southeast-1",
  Australia: "ap-southeast-1",
  Pacific: "ap-southeast-1",
};

// Offset ranges to regions (inclusive bounds)
const offsetRanges: {
  min: number;
  max: number;
  region: BrowserbaseRegion;
}[] = [
  { min: -24, max: -4, region: "us-west-2" }, // UTC-24 to UTC-4
  { min: -3, max: 4, region: "eu-central-1" }, // UTC-3 to UTC+4
  { min: 5, max: 24, region: "ap-southeast-1" }, // UTC+5 to UTC+24
];

function getClosestRegion(timezone?: string): BrowserbaseRegion {
  try {
    if (!timezone) {
      return "us-west-2"; // Default if no timezone provided
    }

    // Check exact matches first
    if (timezone in exactTimezoneMap) {
      return exactTimezoneMap[timezone];
    }

    // Check prefix matches
    const prefix = timezone.split("/")[0];
    if (prefix in prefixToRegion) {
      return prefixToRegion[prefix];
    }

    // Use offset-based fallback
    const date = new Date();
    // Create a date formatter for the given timezone
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    // Get the timezone offset in minutes
    const timeString = formatter.format(date);
    const testDate = new Date(timeString);
    const hourOffset = (testDate.getTime() - date.getTime()) / (1000 * 60 * 60);

    const matchingRange = offsetRanges.find(
      (range) => hourOffset >= range.min && hourOffset <= range.max
    );

    return matchingRange?.region ?? "us-west-2";
  } catch {
    return "us-west-2";
  }
}

async function createSession(timezone?: string, contextId?: string) {
  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const browserSettings: { context?: { id: string; persist: boolean } } = {};
  if (contextId) {
    browserSettings.context = {
      id: contextId,
      persist: true,
    };
  } else {
    const context = await bb.contexts.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
    });
    browserSettings.context = {
      id: context.id,
      persist: true,
    };
  }

  console.log("timezone ", timezone);
  console.log("getClosestRegion(timezone)", getClosestRegion(timezone));
  let session;
  try {
    session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings,
      keepAlive: true,
      region: getClosestRegion(timezone),
    });
  } catch (error: any) {
    // If we've hit the concurrency limit (HTTP 429), try to reuse an existing RUNNING session
    if (error?.status === 429) {
      console.warn("[warn] Concurrency limit reached. Attempting to reuse an existing RUNNING session...");
      try {
        // Fetch currently running sessions for the project
        // The Node SDK exposes `.list` – if the typings change we fall back to the raw fetch call
        let runningSessions: any[] = [];
        if (typeof (bb.sessions as any).list === "function") {
          runningSessions = await (bb.sessions as any).list({
            projectId: process.env.BROWSERBASE_PROJECT_ID!,
            status: "RUNNING",
          });
        } else {
          const response = await fetch("https://api.browserbase.com/v1/sessions?status=RUNNING", {
            headers: {
              "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
            },
          });
          if (response.ok) {
            runningSessions = await response.json();
          }
        }

        if (runningSessions.length > 0) {
          session = runningSessions[0];
          console.log(`[log] Reusing session ${session.id}`);
        } else {
          console.error("[error] No RUNNING sessions available to reuse.");
          throw error; // rethrow to be handled by caller
        }
      } catch (reuseErr) {
        console.error("[error] Failed to reuse existing session", reuseErr);
        throw error; // propagate original 429
      }
    } else {
      throw error; // propagate non-rate-limit errors
    }
  }
  
  if (!session) {
    throw new Error("Unable to acquire a Browserbase session");
  }
  
  // Wait for session to be ready
  console.log("Waiting for session to be ready...");
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      const sessionStatus = await bb.sessions.retrieve(session.id);
      console.log(`Session status check ${attempts + 1}: ${sessionStatus.status}`);
      
      if (sessionStatus.status === 'RUNNING') {
        console.log("Session is ready!");
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.error("Error checking session status:", error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (attempts >= maxAttempts) {
    console.warn("Session status check timed out, proceeding anyway");
  }
  
  return {
    session,
    contextId: browserSettings.context?.id,
  };
}

async function endSession(sessionId: string) {
  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  await bb.sessions.update(sessionId, {
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    status: "REQUEST_RELEASE",
  });
}

async function getDebugUrl(sessionId: string) {
  const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
  });
  const session = await bb.sessions.debug(sessionId);
  return session.debuggerFullscreenUrl;
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
    const liveUrl = await getDebugUrl(session.id);
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionUrl: liveUrl,
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
  const body = await request.json();
  const sessionId = body.sessionId as string;
  await endSession(sessionId);
  return NextResponse.json({ success: true });
}
