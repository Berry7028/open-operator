import { NextResponse } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { CoreMessage, generateObject, LanguageModelV1, UserContent } from "ai";
import { z } from "zod";
import { ObserveResult, Stagehand } from "@browserbasehq/stagehand";
import { availableTools, executeAgentTool, isSessionActive } from "../../lib/agent-tools";
import { getSessionApiKey } from "../../lib/session-utils";

// Initialize LLM clients based on available API keys
const getModelClient = (modelId: string): LanguageModelV1 => {
  if (modelId.startsWith('gpt-') || modelId.startsWith('o1-') || modelId.startsWith('o3-')) {
    const apiKey = getSessionApiKey('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }
    const provider = createOpenAI({ apiKey });
    return provider(modelId);
  } else if (modelId.startsWith('claude-')) {
    const apiKey = getSessionApiKey('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    const provider = createAnthropic({ apiKey });
    return provider(modelId);
  } else if (modelId.startsWith('gemini-')) {
    const apiKey = getSessionApiKey('GOOGLE_AI_API_KEY');
    if (!apiKey) {
      throw new Error('Google AI API key not configured');
    }
    const provider = createGoogleGenerativeAI({ apiKey });
    return provider(modelId);
  } else {
    // Default fallback
    const apiKey = getSessionApiKey('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('No API keys configured');
    }
    const provider = createAnthropic({ apiKey });
    return provider("claude-3-5-sonnet-20241022");
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
  language = 'ja',
}: {
  goal: string;
  sessionID: string;
  previousSteps?: Step[];
  previousExtraction?: string | ObserveResult[];
  modelId?: string;
  selectedTools?: string[];
  language?: 'ja' | 'en';
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

  // Build a full tool availability list for the LLM
  const toolsStatusList = availableTools.map(tool => `- ${tool.name}: ${selectedTools.includes(tool.name) ? 'enabled: true' : 'enabled: false'}`);

  const toolsDescription = `\n\nTOOL AVAILABILITY LIST (enabled = can use):\n${toolsStatusList.join('\n')}

RULES FOR USING TOOLS:
1. ONLY use tools with enabled: true.
2. If the user requests a tool with enabled: false, respond with a brief apology and explain that the tool is not available in the current session. Do NOT attempt to use it.`;

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

If the goal has been achieved, return "CLOSE".${toolsDescription}

IMPORTANT LANGUAGE INSTRUCTION:
Please respond in ${language === 'ja' ? 'Japanese (日本語)' : 'English'}. All explanations, reasoning, and text should be in ${language === 'ja' ? 'Japanese' : 'English'}.`,
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

async function analyzeGoalForTools(goal: string, modelId: string, selectedTools: string[] = [], language: 'ja' | 'en' = 'ja'): Promise<{
  useTools: boolean;
  toolName?: string;
  params?: Record<string, unknown>;
  reasoning: string;
}> {
  // Use only tools explicitly selected by the user.
  const enabledTools = availableTools.filter(tool => selectedTools.includes(tool.name));

  const message: CoreMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Analyze this goal: "${goal}"

Available local tools:
${enabledTools.map(tool => `- ${tool.name}: ${tool.description} (Category: ${tool.category})`).join('\n')}

Full tool availability list (enabled = can use):
${availableTools.map(tool => `- ${tool.name}: ${selectedTools.includes(tool.name) ? 'enabled: true' : 'enabled: false'}`).join('\n')}

Rules:
1. Only propose using tools where enabled = true.
2. If the user goal explicitly requires a tool with enabled = false, respond that it cannot be accomplished with local tools and consider web browsing instead.

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
If it requires web browsing, explain why.

Please respond in ${language === 'ja' ? 'Japanese (日本語)' : 'English'}.`,
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

async function parseNaturalLanguageInstruction(
  instruction: string, 
  modelId: string, 
  selectedTools: string[] = []
): Promise<{ toolName: string; params: Record<string, unknown> }> {
  // Use only tools explicitly selected by the user.
  const enabledTools = availableTools.filter(tool => selectedTools.includes(tool.name));

  const message: CoreMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Parse this natural language instruction into a proper tool call:

Instruction: "${instruction}"

Available tools:
${enabledTools.map(tool => 
  `- ${tool.name}: ${tool.description}`
).join('\n')}

Based on the instruction, determine:
1. Which tool should be called
2. What parameters are needed

Examples of common patterns:
- "time", "current time", "Tokyo time" → get_current_time with timezone parameter
- "calculate", "math", numbers/expressions → calculate tool
- "create todo", "add task" → create_todo tool
- "list files", "show files" → list_files tool
- "write code", "generate code" → generate_code tool
- "run python", "execute python" → execute_python tool

Return the tool name and parameters in the following format.`,
      },
    ],
  };

  try {
    const result = await generateObject({
      model: getModelClient(modelId),
      schema: z.object({
        toolName: z.string(),
        params: z.record(z.any()),
      }),
      messages: [message],
    });

    return result.object;
  } catch (error) {
    console.error("Failed to parse natural language instruction:", error);
    // フォールバック: デフォルトの時刻取得ツールを返す
    return {
      toolName: "get_current_time",
      params: { timezone: "UTC" }
    };
  }
}

async function generateResponseFromToolResult(
  toolResult: Record<string, unknown>,
  goal: string,
  step: Step,
  modelId: string,
  language: 'ja' | 'en' = 'ja'
): Promise<string> {
  const message: CoreMessage = {
    role: "user",
    content: [
      {
        type: "text",
text: language === 'ja' 
          ? `ユーザーの目標: "${goal}"

実行されたアクション: ${step.text}
使用されたツール: ${step.tool}
ツールの指示: ${step.instruction}

ツール実行結果:
${JSON.stringify(toolResult, null, 2)}

上記のツール実行結果を基に、ユーザーに対する自然で分かりやすい日本語の回答を作成してください。以下の点を考慮してください：

1. 結果が成功した場合は、具体的な内容を含めて報告
2. エラーが発生した場合は、問題点と可能な解決策を提案
3. 技術的な詳細よりも、ユーザーにとって有用な情報を重視
4. 必要に応じて次のステップや関連する提案を含める
5. 親しみやすく、理解しやすい言葉で回答

回答例:
- ファイル作成: "ファイル'example.txt'を正常に作成しました。内容は..."
- 計算結果: "計算結果は25です。計算式: 2+3*4 = 2+12 = 14..."
- Todo作成: "新しいタスク'プロジェクト完了'を優先度'高'で作成しました..."
- エラー時: "申し訳ございませんが、ファイルの作成中にエラーが発生しました。原因は...です。解決するには..."

ユーザーに対する回答:`
          : `User Goal: "${goal}"

Executed Action: ${step.text}
Tool Used: ${step.tool}
Tool Instruction: ${step.instruction}

Tool Execution Result:
${JSON.stringify(toolResult, null, 2)}

Based on the above tool execution result, please create a natural and easy-to-understand English response for the user. Please consider the following points:

1. If the result is successful, report specific content
2. If an error occurs, suggest the problem and possible solutions
3. Focus on information useful to users rather than technical details
4. Include next steps or related suggestions as needed
5. Respond in friendly and understandable language

Response examples:
- File creation: "Successfully created file 'example.txt'. The content is..."
- Calculation result: "The calculation result is 25. Formula: 2+3*4 = 2+12 = 14..."
- Todo creation: "Created new task 'Complete project' with high priority..."
- Error case: "Sorry, an error occurred while creating the file. The cause is... To resolve this..."

Response to user:`,
      },
    ],
  };

  try {
    const result = await generateObject({
      model: getModelClient(modelId),
      schema: z.object({
        response: z.string().describe(
          language === 'ja' 
            ? "ユーザーに対する自然で分かりやすい日本語の回答"
            : "Natural and easy-to-understand English response to the user"
        ),
      }),
      messages: [message],
    });

    return result.object.response;
  } catch (error) {
    console.error("Failed to generate response from tool result:", error);
    
    // より詳細なフォールバック処理
    const errorInfo = {
      message: error instanceof Error ? error.message : 'Unknown error type',
      name: error instanceof Error ? error.name : 'UnknownError',
      stack: error instanceof Error ? error.stack : undefined,
      toolResult: toolResult,
      step: step.tool,
      instruction: step.instruction
    };
    
    console.error("Error generation details:", errorInfo);
    
    // 成功/失敗に関わらず、より詳細な情報を提供
    if (toolResult.success === false) {
      // エラー情報をより詳しく分析
      const errorMessage = toolResult.error as string || 'エラーの詳細が不明です';
      const toolName = step.tool;
      
      // 一般的なエラーパターンに基づいて適切な説明を生成
      let userFriendlyMessage = '';
      
      if (errorMessage.includes('not found') || errorMessage.includes('not exist')) {
        userFriendlyMessage = `申し訳ございませんが、指定されたリソースが見つかりませんでした。ファイルパスやツール名を確認してください。`;
      } else if (errorMessage.includes('permission') || errorMessage.includes('access')) {
        userFriendlyMessage = `アクセス権限の問題が発生しました。ファイルやディレクトリの権限を確認してください。`;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        userFriendlyMessage = `ネットワークの問題またはタイムアウトが発生しました。インターネット接続を確認して再度お試しください。`;
      } else if (errorMessage.includes('syntax') || errorMessage.includes('invalid')) {
        userFriendlyMessage = `入力内容にエラーがあります。指示の形式や内容を確認してください。`;
      } else if (errorMessage.includes('API') || errorMessage.includes('key')) {
        userFriendlyMessage = `API接続の問題が発生しました。設定やAPIキーを確認してください。`;
      } else {
        userFriendlyMessage = `申し訳ございませんが、${toolName}の実行中に問題が発生しました。`;
      }
      
      return `${userFriendlyMessage}\n\n**エラーの詳細**: ${errorMessage}\n\n**解決策**: \n- 入力内容を確認してください\n- 必要なファイルや設定が存在することを確認してください\n- 問題が続く場合は、別の方法でお試しください`;
    } else if (toolResult.success === true) {
      // 成功時でもAI生成に失敗した場合
      const resultData = toolResult.result || toolResult.data || toolResult;
      return `操作が正常に完了しました。\n\n**実行内容**: ${step.text}\n**結果**: ${typeof resultData === 'object' ? JSON.stringify(resultData, null, 2) : resultData}`;
    } else {
      // success フィールドがない場合
      const hasData = Object.keys(toolResult).some(key => 
        key !== 'toolName' && key !== 'params' && key !== 'executedAt'
      );
      
      if (hasData) {
        return `操作を実行しました。\n\n**実行内容**: ${step.text}\n**詳細**: 実行は完了しましたが、結果の詳細な説明の生成中に問題が発生しました。技術的な詳細は実行結果セクションでご確認ください。`;
      } else {
        return `申し訳ございませんが、操作の実行中に予期しない問題が発生しました。\n\n**実行しようとした内容**: ${step.text}\n**ツール**: ${step.tool}\n\n**対処法**: \n- 指示の内容を確認してください\n- 別の方法でお試しください\n- 問題が続く場合は管理者にお問い合わせください`;
      }
    }
  }
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
    const { goal, sessionId, previousSteps = [], action, modelId, selectedTools = [], language = 'ja' } = body;

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
        const canUseTools = await analyzeGoalForTools(goal, modelId, selectedTools, language);
        
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
          // Browser-based approach requires manual session start
          const firstStep = {
            text: "To accomplish this goal, you need to start a browser session first. Please use the 'start_browser_session' tool.",
            reasoning: "Browser operations require an active session. Use start_browser_session tool to begin.",
            tool: "CALL_TOOL" as const,
            instruction: JSON.stringify({
              toolName: "start_browser_session",
              params: { sessionId: sessionId }
            }),
          };

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
          language,
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
          let toolInstruction: { toolName: string; params: Record<string, unknown> } | null = null;
          
          try {
            // 安全なJSONパース処理
            if (typeof step.instruction === 'string') {
              try {
                // JSON文字列かどうかをチェック
                if (step.instruction.trim().startsWith('{') && step.instruction.trim().endsWith('}')) {
                  toolInstruction = JSON.parse(step.instruction);
                } else {
                  // JSONではない場合は、フォールバック処理で適切なツール呼び出しを推測
                  console.warn("Non-JSON instruction detected, attempting to parse:", step.instruction);
                  toolInstruction = await parseNaturalLanguageInstruction(step.instruction, modelId, selectedTools);
                }
              } catch {
                // JSONパースに失敗した場合のフォールバック処理
                console.warn("Failed to parse JSON instruction, attempting fallback:", step.instruction);
                toolInstruction = await parseNaturalLanguageInstruction(step.instruction, modelId, selectedTools);
              }
            } else if (typeof step.instruction === 'object') {
              // 既にオブジェクトの場合
              toolInstruction = step.instruction;
            } else {
              throw new Error('Invalid instruction type');
            }

            if (!toolInstruction) {
              throw new Error('Failed to parse tool instruction');
            }
            
            const { toolName, params } = toolInstruction;
            
            if (!toolName) {
              throw new Error('Missing toolName in instruction');
            }
            
            // Check if the requested tool is enabled in this session
            if (!selectedTools.includes(toolName)) {
              const aiResponse = language === 'ja'
                ? `申し訳ございませんが、ツール「${toolName}」はこのセッションでは利用できません。`
                : `Sorry, I cannot use the "${toolName}" tool because it is not enabled in this session.`;

              extraction = {
                success: false,
                error: `Tool ${toolName} is not enabled`,
                aiResponse,
              };

              return NextResponse.json({ success: true, extraction, done: false });
            }
            
            const toolResult = await executeAgentTool(toolName, params || {});
            
            // ツール実行結果を基にAIが自然な回答を生成
            const aiResponse = await generateResponseFromToolResult(
              toolResult,
              goal || '',
              step,
              modelId,
              language
            );
            
            extraction = {
              ...toolResult,
              aiResponse,
            };
          } catch (error) {
            console.error("Tool execution error:", error);
            
            // より詳細なエラー情報を収集
            const errorDetails = {
              originalError: error,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : 'UnknownError',
              stack: error instanceof Error ? error.stack : undefined,
              toolName: toolInstruction?.toolName || 'unknown',
              params: toolInstruction?.params || {},
              instruction: step.instruction,
              timestamp: new Date().toISOString()
            };
            
            console.error("Detailed tool execution error:", errorDetails);
            
            // ユーザーフレンドリーなエラー説明を生成
            let userErrorMessage = '';
            const errorMsg = errorDetails.errorMessage.toLowerCase();
            
            if (errorMsg.includes('tool') && errorMsg.includes('not found')) {
              userErrorMessage = language === 'ja' 
                ? `指定されたツール「${errorDetails.toolName}」が見つかりません。利用可能なツール一覧を確認してください。`
                : `The specified tool "${errorDetails.toolName}" was not found. Please check the available tool list.`;
            } else if (errorMsg.includes('missing') || errorMsg.includes('required')) {
              userErrorMessage = language === 'ja'
                ? `必要なパラメータが不足しています。ツール「${errorDetails.toolName}」の実行に必要な情報を確認してください。`
                : `Required parameters are missing. Please check the information needed to execute tool "${errorDetails.toolName}".`;
            } else if (errorMsg.includes('invalid') || errorMsg.includes('validation')) {
              userErrorMessage = language === 'ja'
                ? `入力パラメータが正しくありません。ツール「${errorDetails.toolName}」の形式を確認してください。`
                : `Input parameters are incorrect. Please check the format for tool "${errorDetails.toolName}".`;
            } else if (errorMsg.includes('permission') || errorMsg.includes('access denied')) {
              userErrorMessage = language === 'ja'
                ? `アクセス権限の問題があります。ファイルやリソースへのアクセス権限を確認してください。`
                : `Access permission issue occurred. Please check file or resource access permissions.`;
            } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
              userErrorMessage = language === 'ja'
                ? `ネットワークの問題が発生しました。インターネット接続を確認して再度お試しください。`
                : `Network issue occurred. Please check your internet connection and try again.`;
            } else if (errorMsg.includes('api') && errorMsg.includes('key')) {
              userErrorMessage = language === 'ja'
                ? `API設定の問題があります。APIキーが正しく設定されているか確認してください。`
                : `API configuration issue occurred. Please check if the API key is correctly configured.`;
            } else {
              userErrorMessage = language === 'ja'
                ? `ツール「${errorDetails.toolName}」の実行中に問題が発生しました。`
                : `An issue occurred while executing tool "${errorDetails.toolName}".`;
            }
            
            extraction = {
              success: false,
              error: errorDetails.errorMessage,
              userMessage: userErrorMessage,
              toolName: errorDetails.toolName,
              suggestion: language === 'ja' 
                ? "パラメータや設定を確認してから再度お試しください。問題が続く場合は、別のアプローチを検討してください。"
                : "Please check the parameters and settings, then try again. If the problem persists, consider a different approach.",
              timestamp: errorDetails.timestamp,
              aiResponse: language === 'ja'
                ? `${userErrorMessage}\n\n**技術的な詳細**: ${errorDetails.errorMessage}\n\n**提案**: パラメータや設定を確認してから再度お試しください。問題が続く場合は、別のアプローチを検討してください。`
                : `${userErrorMessage}\n\n**Technical Details**: ${errorDetails.errorMessage}\n\n**Suggestion**: Please check the parameters and settings, then try again. If the problem persists, consider a different approach.`
            };
          }
        } else {
          // Check if session is active for browser operations
          const browserTools = ["GOTO", "ACT", "EXTRACT", "OBSERVE", "WAIT", "NAVBACK", "CLOSE"];
          if (browserTools.includes(step.tool)) {
            if (!isSessionActive(sessionId)) {
              extraction = {
                success: false,
                error: `Browser session ${sessionId} is not active. Please start a browser session first using the 'start_browser_session' tool.`,
              };
            } else {
              // Execute browser step using Stagehand
              const browserResult = await runStagehand({
                sessionID: sessionId,
                method: step.tool,
                instruction: step.instruction,
              });
              
              // ブラウザ操作結果にもAI回答を生成
              const aiResponse = await generateResponseFromToolResult(
                browserResult as Record<string, unknown>,
                goal || '',
                step,
                modelId,
                language
              );
              
              extraction = {
                ...(browserResult as Record<string, unknown>),
                aiResponse,
              };
            }
          } else {
            // Execute other non-browser steps
            const otherResult = await runStagehand({
              sessionID: sessionId,
              method: step.tool,
              instruction: step.instruction,
            });
            
                         // その他の操作結果にもAI回答を生成
             const aiResponse = await generateResponseFromToolResult(
               otherResult as Record<string, unknown>,
               goal || '',
               step,
               modelId,
               language
             );
             
             extraction = {
               ...(otherResult as Record<string, unknown>),
               aiResponse,
             };
          }
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