import { AgentTool } from "./types";
import { 
  startBrowserSessionSchema, 
  getBrowserSessionStatusSchema, 
  closeBrowserSessionSchema 
} from "./schemas";
import { 
  isSessionActive, 
  startSession, 
  closeSession, 
  getSessionStatus 
} from "./helpers/session-manager";

export const browserTools: AgentTool[] = [
  {
    name: "start_browser_session",
    description: "Start a new browser session for web automation tasks. This enables browser automation tools like navigation, interaction, and data extraction.",
    category: "browser",
    parameters: startBrowserSessionSchema,
    execute: async (params) => {
      try {
        const { sessionId } = params as { sessionId: string };
        
        if (isSessionActive(sessionId)) {
          return {
            success: false,
            error: `Session ${sessionId} is already active`,
          };
        }
        
        // Check if Browserbase is configured
        if (!process.env.BROWSERBASE_API_KEY || process.env.BROWSERBASE_API_KEY === 'your_browserbase_api_key_here') {
          console.warn("Browserbase not configured, using mock session");
          startSession(sessionId);
          return {
            success: true,
            message: `Mock browser session ${sessionId} started successfully (Browserbase not configured)`,
            sessionId,
            startedAt: new Date().toISOString(),
            mode: "mock",
          };
        }
        
        // Mark session as active in our tracking
        startSession(sessionId);
        
        return {
          success: true,
          message: `Browser session ${sessionId} started successfully. You can now use browser automation tools like navigation, clicking, and data extraction.`,
          sessionId,
          startedAt: new Date().toISOString(),
          mode: "browserbase",
          availableTools: [
            "Navigate to websites (GOTO)",
            "Interact with page elements (ACT)", 
            "Extract data from pages (EXTRACT)",
            "Observe page elements (OBSERVE)",
            "Take screenshots (SCREENSHOT)",
            "Wait for page loads (WAIT)",
            "Navigate back (NAVBACK)"
          ]
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to start browser session: ${error}`,
        };
      }
    },
  },
  {
    name: "get_browser_session_status",
    description: "Check the status of a browser session",
    category: "browser", 
    parameters: getBrowserSessionStatusSchema,
    execute: async (params) => {
      try {
        const { sessionId } = params as { sessionId: string };
        const session = getSessionStatus(sessionId);
        
        if (!session) {
          return {
            success: true,
            status: "not_found",
            message: `No session found with ID: ${sessionId}`,
          };
        }
        
        return {
          success: true,
          status: session.isActive ? "active" : "inactive",
          sessionId: session.sessionId,
          startedAt: session.startedAt.toISOString(),
          isActive: session.isActive,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get session status: ${error}`,
        };
      }
    },
  },
  {
    name: "close_browser_session",
    description: "Close an active browser session",
    category: "browser",
    parameters: closeBrowserSessionSchema,
    execute: async (params) => {
      try {
        const { sessionId } = params as { sessionId: string };
        
        if (!isSessionActive(sessionId)) {
          return {
            success: false,
            error: `Session ${sessionId} is not active or does not exist`,
          };
        }
        
        closeSession(sessionId);
        
        return {
          success: true,
          message: `Browser session ${sessionId} closed successfully`,
          sessionId,
          closedAt: new Date().toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to close browser session: ${error}`,
        };
      }
    },
  },
]; 