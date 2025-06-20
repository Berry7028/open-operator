import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { CoreMessage, generateObject, LanguageModelV1, UserContent } from "ai";
import { z } from "zod";
import { ObserveResult, Stagehand } from "@browserbasehq/stagehand";

const LLMClient = anthropic("claude-3-7-sonnet-latest");

type Step = {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK";
  instruction: string;
};

async function runStagehand({
  sessionID,
  method,
  instruction,
}: {
  sessionID: string;
  method:
    | "GOTO"
    | "ACT"
    | "EXTRACT"
    | "CLOSE"
    | "SCREENSHOT"
    | "OBSERVE"
    | "WAIT"
    | "NAVBACK";
  instruction?: string;
}) {
  const stagehand = new Stagehand({
    browserbaseSessionID: sessionID,
    env: "BROWSERBASE",
    modelName: "claude-3.5-haiku",
    modelClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    },
    disablePino: true,
    useAPI: false,
    verbose: 1, // Enable more verbose logging
  });
  
  try {
    // Add retry logic for initialization with exponential backoff
    let initAttempts = 0;
    const maxAttempts = 3;
    let lastError: Error | null = null;
    
    while (initAttempts < maxAttempts) {
      try {
        console.log(`[log] Attempting Stagehand initialization (attempt ${initAttempts + 1}/${maxAttempts})`);
        await stagehand.init();
        
        // Additional wait for browser context to be fully ready
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // More thorough validation of browser context
        console.log(`[log] Validating browser context...`);
        console.log(`[log] stagehand.page exists: ${!!stagehand.page}`);
        
        if (stagehand.page) {
          try {
            console.log(`[log] Testing page context...`);
            const context = stagehand.page.context();
            console.log(`[log] Page context exists: ${!!context}`);
            
            // Test if we can get browser info
            const browser = context.browser();
            console.log(`[log] Browser exists: ${!!browser}`);
            
            // Test basic page functionality
            const isConnected = stagehand.page.isClosed();
            console.log(`[log] Page is closed: ${isConnected}`);
            
            if (isConnected) {
              throw new Error("Page is already closed");
            }
            
          } catch (pageError) {
            console.error(`[log] Page validation failed:`, pageError);
            throw new Error(`Page context validation failed: ${pageError instanceof Error ? pageError.message : String(pageError)}`);
          }
        }
        
        // Check if browser context is properly initialized
        if (!stagehand.page) {
          throw new Error("Failed to initialize Stagehand page. Browser context is undefined.");
        }
        
        console.log(`[log] Stagehand initialization successful on attempt ${initAttempts + 1}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error as Error;
        initAttempts++;
        console.log(`[log] Initialization attempt ${initAttempts} failed:`, error);
        
        if (initAttempts < maxAttempts) {
          // Exponential backoff: wait 3s, then 6s
          const waitTime = 3000 * initAttempts;
          console.log(`[log] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    // If all attempts failed, throw the last error
    if (initAttempts >= maxAttempts) {
      console.error(`[log] Failed to initialize Stagehand after ${maxAttempts} attempts`);
      throw lastError || new Error("Failed to initialize Stagehand after multiple attempts");
    }

    const page = stagehand.page;

    switch (method) {
      case "GOTO": {
        const exec = async () => {
          await page.goto(instruction!, {
            waitUntil: "commit",
            timeout: 60000,
          });
        };
        await retryStagehand(exec);
        break;
      }

      case "ACT": {
        const exec = async () => {
          await page.act(instruction!);
        };
        await retryStagehand(exec);
        break;
      }

      case "EXTRACT": {
        const exec = async () => {
          const { extraction } = await page.extract(instruction!);
          return extraction;
        };
        return await retryStagehand(exec);
      }

      case "OBSERVE": {
        const exec = async () => page.observe(instruction!);
        return await retryStagehand(exec);
      }

      case "CLOSE":
        await stagehand.close();
        return;

      case "SCREENSHOT": {
        try {
          const cdpSession = await page.context().newCDPSession(page);
          const { data } = await cdpSession.send("Page.captureScreenshot");
          return data;
        } catch (screenshotError) {
          console.error("Error taking screenshot:", screenshotError);
          throw new Error(`Failed to take screenshot: ${screenshotError instanceof Error ? screenshotError.message : String(screenshotError)}`);
        }
      }

      case "WAIT":
        await new Promise((resolve) =>
          setTimeout(resolve, Number(instruction))
        );
        break;

      case "NAVBACK":
        await page.goBack();
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  } catch (error) {
    console.error(`Error in runStagehand (${method}):`, error);
    try {
      await stagehand.close();
    } catch (closeError) {
      console.error("Error closing stagehand:", closeError);
    }
    throw error;
  } finally {
    // For methods other than CLOSE, ensure proper cleanup
    if (method !== "CLOSE") {
      try {
        await stagehand.close();
      } catch (closeError) {
        console.error("Error in final cleanup:", closeError);
      }
    }
  }
}

async function sendPrompt({
  goal,
  sessionID,
  previousSteps = [],
  previousExtraction,
}: {
  goal: string;
  sessionID: string;
  previousSteps?: Step[];
  previousExtraction?: string | ObserveResult[];
}) {
  let currentUrl = "";

  try {
    const stagehand = new Stagehand({
      browserbaseSessionID: sessionID,
      env: "BROWSERBASE",
      disablePino: true,
      useAPI: false,
      modelName: "claude-3.5-haiku",
      modelClientOptions: {
        apiKey: process.env.ANTHROPIC_API_KEY || "",
      },
      verbose: 1,
    });
    
    // Add retry logic for initialization
    let initAttempts = 0;
    const maxAttempts = 3;
    
    while (initAttempts < maxAttempts) {
      try {
        await stagehand.init();
        
        // Additional wait for browser context
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!stagehand.page) {
          throw new Error("Failed to initialize Stagehand page. Browser context is undefined.");
        }
        
        currentUrl = await stagehand.page.url();
        await stagehand.close();
        break; // Success
        
      } catch (error) {
        initAttempts++;
        if (initAttempts >= maxAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 2000 * initAttempts));
      }
    }
  } catch (error) {
    console.error("Error getting page info:", error);
  }

  const content: UserContent = [
    {
      type: "text",
      text: `Consider the following screenshot of a web page${
        currentUrl ? ` (URL: ${currentUrl})` : ""
      }, with the goal being "${goal}".
${
  previousSteps.length > 0
    ? `Previous steps taken:
${previousSteps
  .map(
    (step, index) => `
Step ${index + 1}:
- Action: ${step.text}
- Reasoning: ${step.reasoning}
- Tool Used: ${step.tool}
- Instruction: ${step.instruction}
`
  )
  .join("\n")}`
    : ""
}
Determine the immediate next step to take to achieve the goal. 

Important guidelines:
1. Break down complex actions into individual atomic steps
2. For ACT commands, use only one action at a time, such as:
   - Single click on a specific element
   - Type into a single input field
   - Select a single option
3. Avoid combining multiple actions in one instruction
4. If multiple actions are needed, they should be separate steps

If the goal has been achieved, return "close".`,
    },
  ];

  // Add screenshot if navigated to a page previously
  if (
    previousSteps.length > 0 &&
    previousSteps.some((step) => step.tool === "GOTO")
  ) {
    content.push({
      type: "image",
      image: (await runStagehand({
        sessionID,
        method: "SCREENSHOT",
      })) as string,
    });
  }

  if (previousExtraction) {
    content.push({
      type: "text",
      text: `The result of the previous ${
        Array.isArray(previousExtraction) ? "observation" : "extraction"
      } is: ${previousExtraction}.`,
    });
  }

  const message: CoreMessage = {
    role: "user",
    content,
  };

  const result = await generateObject({
    model: LLMClient as LanguageModelV1,
    schema: z.object({
      text: z.string(),
      reasoning: z.string(),
      tool: z.enum([
        "GOTO",
        "ACT",
        "EXTRACT",
        "OBSERVE",
        "CLOSE",
        "WAIT",
        "NAVBACK",
      ]),
      instruction: z.string(),
    }),
    messages: [message],
  });

  return {
    result: result.object,
    previousSteps: [...previousSteps, result.object],
  };
}

async function selectStartingUrl(goal: string) {
  const message: CoreMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Given the goal: "${goal}", determine the best URL to start from.
Choose from:
1. A relevant search engine (Google, Bing, etc.)
2. A direct URL if you're confident about the target website
3. Any other appropriate starting point

Return a URL that would be most effective for achieving this goal.`,
      },
    ],
  };

  const result = await generateObject({
    model: LLMClient as LanguageModelV1,
    schema: z.object({
      url: z.string().url(),
      reasoning: z.string(),
    }),
    messages: [message],
  });

  return result.object;
}

export async function GET() {
  return NextResponse.json({ message: "Agent API endpoint ready" });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
    const { goal, sessionId, previousSteps = [], action } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId in request body" },
        { status: 400 }
      );
    }

    // Handle different action types
    switch (action) {
      case "START": {
        if (!goal) {
          return NextResponse.json(
            { error: "Missing goal in request body" },
            { status: 400 }
          );
        }

        // Handle first step with URL selection
        const { url, reasoning } = await selectStartingUrl(goal);
        const firstStep = {
          text: `Navigating to ${url}`,
          reasoning,
          tool: "GOTO" as const,
          instruction: url,
        };

        await runStagehand({
          sessionID: sessionId,
          method: "GOTO",
          instruction: url,
        });

        return NextResponse.json({
          success: true,
          result: firstStep,
          steps: [firstStep],
          done: false,
        });
      }

      case "GET_NEXT_STEP": {
        if (!goal) {
          return NextResponse.json(
            { error: "Missing goal in request body" },
            { status: 400 }
          );
        }

        // Get the next step from the LLM
        const { result, previousSteps: newPreviousSteps } = await sendPrompt({
          goal,
          sessionID: sessionId,
          previousSteps,
        });

        return NextResponse.json({
          success: true,
          result,
          steps: newPreviousSteps,
          done: result.tool === "CLOSE",
        });
      }

      case "EXECUTE_STEP": {
        const { step } = body;
        if (!step) {
          return NextResponse.json(
            { error: "Missing step in request body" },
            { status: 400 }
          );
        }

        // Execute the step using Stagehand
        const extraction = await runStagehand({
          sessionID: sessionId,
          method: step.tool,
          instruction: step.instruction,
        });

        return NextResponse.json({
          success: true,
          extraction,
          done: step.tool === "CLOSE",
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action type" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in agent endpoint:", error);
    
    // Provide more specific error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      sessionId: body.sessionId,
      action: body.action,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process request",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

async function retryStagehand<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err?.message || "";
      if (
        attempt < maxRetries &&
        (msg.includes("Failed to parse server response") ||
          msg.includes("browser context is undefined") ||
          msg.includes("Target page") ||
          err?.name === "StagehandResponseParseError")
      ) {
        attempt++;
        const wait = 2000 * attempt;
        console.warn(`Stagehand transient error, retrying in ${wait}ms... (attempt ${attempt}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
}
