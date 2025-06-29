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
  // Check if we're in mock mode (session ID starts with mock- or fallback-)
  if (sessionID.startsWith('mock-') || sessionID.startsWith('fallback-')) {
    console.log(`Mock Stagehand: ${method} - ${instruction}`);
    
    // Return mock responses for different methods
    switch (method) {
      case "GOTO":
        return { success: true, message: `Navigated to ${instruction}` };
      
      case "ACT":
        return { success: true, message: `Performed action: ${instruction}` };
      
      case "EXTRACT":
        return { 
          success: true, 
          data: `Extracted information from page about: ${instruction}`,
          mockData: true 
        };
      
      case "OBSERVE":
        return [
          { 
            id: 1, 
            selector: "body", 
            description: `Mock observation: ${instruction}`, 
            action: "click" 
          }
        ];
      
      case "SCREENSHOT":
        return "mock-screenshot-data";
      
      case "WAIT":
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(Number(instruction), 1000)) // Max 1 second in mock mode
        );
        break;
      
      case "NAVBACK":
        return { success: true, message: "Navigated back" };
      
      case "CLOSE":
        return { success: true, message: "Session closed" };
      
      default:
        return { success: true, message: `Mock ${method} completed` };
    }
    return;
  }

  // Check if Browserbase is properly configured
  if (!process.env.BROWSERBASE_API_KEY || process.env.BROWSERBASE_API_KEY === 'your_browserbase_api_key_here') {
    console.warn("Browserbase not configured, using mock mode");
    return runStagehand({ sessionID: 'mock-' + sessionID, method, instruction });
  }

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
    ? `\n\nAvailable Local Tools (PREFERRED):
ALWAYS prioritize using local tools over web browsing when possible. Use CALL_TOOL for these tasks:

${enabledTools.map(tool => 
  `- ${tool.name}: ${tool.description} (Category: ${tool.category})`
).join('\n')}

To use a tool (PREFERRED METHOD):
- tool: "CALL_TOOL"
- instruction: JSON string with format: {"toolName": "tool_name", "params": {...}}

Examples:
- Calculations: {"toolName": "calculate", "params": {"expression": "2+3*4"}}
- Create Todo: {"toolName": "create_todo", "params": {"title": "Complete project", "priority": "high"}}
- Write code: {"toolName": "generate_code", "params": {"language": "python", "description": "sort a list"}}
- Execute Python: {"toolName": "execute_python", "params": {"code": "print(sum([1,2,3,4,5]))"}}
- File operations: {"toolName": "create_file", "params": {"path": "hello.txt", "content": "Hello World"}}`
    : '';

  const shouldUseBrowser = previousSteps.some(step => step.tool === "GOTO") || currentUrl;
  
  const content: UserContent = [
    {
      type: "text",
      text: `Goal: "${goal}"

${shouldUseBrowser ? `Current web page context (URL: ${currentUrl || 'unknown'})` : 'Working with local tools and files'}

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
${step.tool === 'CALL_TOOL' ? '- Result: Tool executed successfully' : ''}
`
  )
  .join("\n")}`
    : ""
}

PRIORITY GUIDELINES:
1. **ALWAYS USE LOCAL TOOLS FIRST** - For calculations, file operations, programming, todos, etc.
2. **Only use web browsing** when you need to search for information, visit specific websites, or interact with web applications
3. **For mathematical calculations** - use the "calculate" tool
4. **For programming tasks** - use "generate_code" or "execute_python" tools
5. **For file management** - use "create_file", "read_file", "create_folder" tools
6. **For todo management** - use "create_todo", "list_todos", "update_todo" tools

Determine the immediate next step to achieve the goal.

${shouldUseBrowser ? 'If continuing with web interaction:' : 'Choose the most appropriate tool or action:'}
- Break down complex actions into atomic steps
- Use local tools whenever possible
- Only navigate to websites when absolutely necessary

If the goal has been achieved, return "CLOSE".${toolsDescription}`,
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

async function analyzeGoalForTools(goal: string, modelId: string, selectedTools: string[] = []): Promise<{
  useTools: boolean;
  toolName?: string;
  params?: any;
  reasoning: string;
}> {
  const enabledTools = selectedTools.length > 0 
    ? availableTools.filter(tool => selectedTools.includes(tool.name))
    : availableTools;

  const message: CoreMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Analyze this goal: "${goal}"

Available local tools:
${enabledTools.map(tool => 
  `- ${tool.name}: ${tool.description} (Category: ${tool.category})`
).join('\n')}

Determine if this goal can be accomplished using local tools instead of web browsing.

Examples of tasks that should use tools:
- Mathematical calculations → use "calculate" tool
- Creating todos or task lists → use "create_todo" tool  
- Writing or generating code → use "generate_code" tool
- Running Python code → use "execute_python" tool
- File operations (create, read, edit files) → use file tools
- Data processing or analysis → use programming tools

Examples of tasks that need web browsing:
- Searching for current information online
- Visiting specific websites
- Online shopping or booking
- Social media interactions
- Accessing web applications

If this goal can be solved with tools, suggest the first tool to use and its parameters.
If it requires web browsing, explain why.`,
      },
    ],
  };

  const result = await generateObject({
    model: getModelClient(modelId),
    schema: z.object({
      useTools: z.boolean(),
      toolName: z.string().optional(),
      params: z.record(z.any()).optional(),
      reasoning: z.string(),
    }),
    messages: [message],
  });

  return result.object;
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

        // Analyze if this goal can be solved with tools instead of browser
        const canUseTools = await analyzeGoalForTools(goal, modelId, selectedTools);
        
        if (canUseTools.useTools) {
          // Start with tool-based approach
          const firstStep = {
            text: canUseTools.reasoning,
            reasoning: `This task can be accomplished using local tools: ${canUseTools.toolName}`,
            tool: "CALL_TOOL" as const,
            instruction: JSON.stringify({
              toolName: canUseTools.toolName,
              params: canUseTools.params
            }),
          };

          return NextResponse.json({
            success: true,
            result: firstStep,
            steps: [firstStep],
            done: false,
          });
        } else {
          // Fallback to browser-based approach
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