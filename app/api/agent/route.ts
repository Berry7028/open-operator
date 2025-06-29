import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { CoreMessage, generateObject, LanguageModelV1, UserContent } from "ai";
import { z } from "zod";
import { ObserveResult, Stagehand } from "@browserbasehq/stagehand";
import { availableTools, executeAgentTool } from "../../lib/agent-tools";
import { getSessionApiKey } from "../settings/route";

// Initialize LLM clients based on available API keys
const getModelClient = (modelId: string): LanguageModelV1 => {
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1-')) {
    const apiKey = getSessionApiKey('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    return openai(modelId, { apiKey });
  } else if (modelId.startsWith('claude-')) {
    const apiKey = getSessionApiKey('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    return anthropic(modelId, { apiKey });
  } else if (modelId.startsWith('gemini-')) {
    const apiKey = getSessionApiKey('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }
    return google(modelId, { apiKey });
  } else {
    // Default fallback
    const apiKey = getSessionApiKey('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('No API keys configured');
    }
    return anthropic("claude-3-5-sonnet-20241022", { apiKey });
  }
};

type Step = {
  text: string;
  reasoning: string;
  tool: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK" | "CALL_TOOL";
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
    modelName: "google/gemini-2.0-flash",
    disablePino: true,
  });
  await stagehand.init();

  const page = stagehand.page;

  try {
    switch (method) {
      case "GOTO":
        await page.goto(instruction!, {
          waitUntil: "commit",
          timeout: 60000,
        });
        break;

      case "ACT":
        await page.act(instruction!);
        break;

      case "EXTRACT": {
        const { extraction } = await page.extract(instruction!);
        return extraction;
      }

      case "OBSERVE":
        return await page.observe(instruction!);

      case "CLOSE":
        await stagehand.close();
        break;

      case "SCREENSHOT": {
        const cdpSession = await page.context().newCDPSession(page);
        const { data } = await cdpSession.send("Page.captureScreenshot");
        return data;
      }

      case "WAIT":
        await new Promise((resolve) =>
          setTimeout(resolve, Number(instruction))
        );
        break;

      case "NAVBACK":
        await page.goBack();
        break;
    }
  } catch (error) {
    await stagehand.close();
    throw error;
  }
}

async function sendPrompt({
  goal,
  sessionID,
  previousSteps = [],
  previousExtraction,
  modelId = "claude-3-5-sonnet-20241022",
  selectedTools = [],
}: {
  goal: string;
  sessionID: string;
  previousSteps?: Step[];
  previousExtraction?: string | ObserveResult[];
  modelId?: string;
  selectedTools?: string[];
}) {
  let currentUrl = "";

  try {
    const stagehand = new Stagehand({
      browserbaseSessionID: sessionID,
      env: "BROWSERBASE",
      disablePino: true,
      modelName: "google/gemini-2.0-flash",
    });
    await stagehand.init();
    currentUrl = await stagehand.page.url();
    await stagehand.close();
  } catch (error) {
    console.error("Error getting page info:", error);
  }

  // Filter available tools based on selection
  const enabledTools = selectedTools.length > 0 
    ? availableTools.filter(tool => selectedTools.includes(tool.name))
    : availableTools;

  const toolsDescription = enabledTools.length > 0 
    ? `\n\nAvailable Tools:
You can use the following tools by setting tool to "CALL_TOOL" and providing the tool name and parameters in the instruction field as JSON:

${enabledTools.map(tool => 
  `- ${tool.name}: ${tool.description} (Category: ${tool.category})`
).join('\n')}

To use a tool, set:
- tool: "CALL_TOOL"
- instruction: JSON string with format: {"toolName": "tool_name", "params": {...}}

Example: {"toolName": "create_todo", "params": {"title": "Complete project", "priority": "high"}}`
    : '';

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
5. You can use external tools when appropriate for the task
6. Consider using tools for file operations, programming tasks, calculations, etc.

If the goal has been achieved, return "close".${toolsDescription}`,
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
      } is: ${JSON.stringify(previousExtraction)}.`,
    });
  }

  const message: CoreMessage = {
    role: "user",
    content,
  };

  const result = await generateObject({
    model: getModelClient(modelId),
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
        "CALL_TOOL",
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

async function selectStartingUrl(goal: string, modelId: string = "claude-3-5-sonnet-20241022") {
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
    model: getModelClient(modelId),
    schema: z.object({
      url: z.string().url(),
      reasoning: z.string(),
    }),
    messages: [message],
  });

  return result.object;
}

export async function GET() {
  return NextResponse.json({ 
    message: "Agent API endpoint ready",
    availableTools: availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
    }))
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { goal, sessionId, previousSteps = [], action, modelId, selectedTools = [] } = body;

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
        const { url, reasoning } = await selectStartingUrl(goal, modelId);
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
          modelId,
          selectedTools,
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

        let extraction = null;

        // Handle tool execution
        if (step.tool === "CALL_TOOL") {
          try {
            const toolInstruction = JSON.parse(step.instruction);
            const { toolName, params } = toolInstruction;
            
            const toolResult = await executeAgentTool(toolName, params);
            extraction = toolResult;
          } catch (error) {
            console.error("Tool execution error:", error);
            extraction = {
              success: false,
              error: `Failed to execute tool: ${error}`,
            };
          }
        } else {
          // Execute browser step using Stagehand
          extraction = await runStagehand({
            sessionID: sessionId,
            method: step.tool,
            instruction: step.instruction,
          });
        }

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
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}