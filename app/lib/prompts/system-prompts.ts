export interface SystemPromptOptions {
  goal: string;
  language: 'ja' | 'en';
  selectedTools: string[];
  availableTools: Array<{ name: string; description: string; category: string }>;
  currentUrl?: string;
  previousSteps: Array<{
    action: string;
    result: string;
    timestamp?: string;
    tool?: string;
  }>;
  previousExtraction?: string | Array<{
    content: string;
    source: string;
    timestamp?: string;
  }>;
  loopPreventionGuidance?: string;
  shouldUseBrowser: boolean;
}

export const systemPrompts = {
  ja: {
    main: `目標: "{goal}"{loopPreventionGuidance}
    !! IMPORTANT: ツールは複数回実行しないでください。一度実行したら、次のステップに進んでください。
    
{contextSection}

{previousStepsSection}

**優先順位ガイドライン:**
1. **ローカルツールを優先** - 計算、ファイル操作、プログラミング、Todo管理等
2. **ウェブブラウジング** - 情報検索、特定サイト訪問、ウェブアプリ操作が必要な場合のみ
3. **数学計算** → "calculate"ツールを使用
4. **プログラミング** → "generate_code"、"execute_python"ツールを使用
5. **ファイル管理** → "create_file"、"read_file"、"create_folder"ツールを使用
6. **Todo管理** → "create_todo"、"list_todos"、"update_todo"ツールを使用

{actionSection}

目標を達成したら、"format_final_answer"ツールを一度呼び出して、完全な回答を"answer"パラメータに渡してユーザーに表示してください。

目標が達成されたら、ツール呼び出し後に"CLOSE"を返してください。{toolsDescription}

**重要:** 日本語で回答してください。すべての説明、推論、テキストは日本語で記述してください。`,

    priorities: {
      localFirst: "ローカルツールを優先して使用してください",
      webBrowsingOnly: "情報検索やウェブサイト訪問が必要な場合のみウェブブラウジングを使用",
      calculations: "数学計算には'calculate'ツール",
      programming: "プログラミングタスクには'generate_code'や'execute_python'ツール",
      fileOps: "ファイル操作には'create_file'、'read_file'等のツール",
      todos: "Todo管理には'create_todo'、'list_todos'等のツール"
    },

    actions: {
      browser: "ウェブ操作を続行する場合:",
      local: "適切なツールまたはアクションを選択:",
      breakdown: "複雑なアクションを単純なステップに分解",
      prioritize: "可能な限りローカルツールを使用",
      navigate: "必要な場合のみウェブサイトにアクセス"
    }
  },

  en: {
    main: `Goal: "{goal}"{loopPreventionGuidance}

{contextSection}

{previousStepsSection}

**PRIORITY GUIDELINES:**
1. **ALWAYS USE LOCAL TOOLS FIRST** - For calculations, file operations, programming, todos, etc.
2. **Only use web browsing** when you need to search for information, visit specific websites, or interact with web applications
3. **For mathematical calculations** - use the "calculate" tool
4. **For programming tasks** - use "generate_code" or "execute_python" tools
5. **For file management** - use "create_file", "read_file", "create_folder" tools
6. **For todo management** - use "create_todo", "list_todos", "update_todo" tools

{actionSection}

When you have reached the final answer for the user's goal, CALL the "format_final_answer" tool once, passing the complete answer text in the "answer" parameter so that it can be displayed to the user.

If the goal has been achieved, after calling the tool you should return "CLOSE".{toolsDescription}

**IMPORTANT:** Please respond in English. All explanations, reasoning, and text should be in English.`,

    priorities: {
      localFirst: "Prioritize local tools usage",
      webBrowsingOnly: "Use web browsing only when necessary for information search or website interaction",
      calculations: "Use 'calculate' tool for mathematical calculations",
      programming: "Use 'generate_code' or 'execute_python' tools for programming tasks",
      fileOps: "Use 'create_file', 'read_file', etc. for file operations",
      todos: "Use 'create_todo', 'list_todos', etc. for todo management"
    },

    actions: {
      browser: "If continuing with web interaction:",
      local: "Choose the most appropriate tool or action:",
      breakdown: "Break down complex actions into atomic steps",
      prioritize: "Use local tools whenever possible",
      navigate: "Only navigate to websites when absolutely necessary"
    }
  }
}; 