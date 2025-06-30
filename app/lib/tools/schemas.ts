import { z } from "zod";

// セッションIDをスキーマに追加するヘルパー
export const withSessionId = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.extend({
    sessionId: z.string().optional().describe(
      "Chat session ID used to scope paths under workspace/<sessionId>. If omitted, the global workspace root is used."
    ),
  });

// ファイルシステム関連スキーマ
export const createFileSchema = withSessionId(
  z.object({
    path: z.string().describe("File path to create (relative to the session workspace)"),
    content: z.string().describe("File content"),
  })
);

export const createFolderSchema = withSessionId(
  z.object({
    path: z.string().describe("Folder path to create (relative to the session workspace)"),
  })
);

export const readFileSchema = withSessionId(
  z.object({
    path: z.string().describe("File path to read (relative to the session workspace)"),
  })
);

export const listFilesSchema = withSessionId(
  z.object({
    path: z.string().optional().describe("Directory path to list (relative to the session workspace, default: '.')"),
  })
);

// プログラミング関連スキーマ
export const generateCodeSchema = withSessionId(
  z.object({
    language: z.string().describe("Programming language"),
    description: z.string().describe("What the code should do"),
    framework: z.string().optional().describe("Framework to use (if any)"),
    filename: z.string().optional().describe("Filename to save the code"),
  })
);

export const analyzeCodeSchema = z.object({
  code: z.string().describe("Code to analyze"),
  language: z.string().describe("Programming language"),
});

export const executePythonSchema = z.object({
  code: z.string().describe("Python code to execute"),
  description: z.string().optional().describe("Description of what the code does"),
});

// Todo管理関連スキーマ
export const createTodoSchema = z.object({
  title: z.string().describe("Todo title"),
  description: z.string().optional().describe("Todo description"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().describe("Due date (YYYY-MM-DD format)"),
});

export const listTodosSchema = z.object({
  status: z.enum(["all", "pending", "completed"]).default("all"),
});

export const updateTodoSchema = z.object({
  id: z.string().describe("Todo ID"),
  status: z.enum(["pending", "completed"]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

// ユーティリティ関連スキーマ
export const getCurrentTimeSchema = z.object({
  timezone: z.string().optional().describe("Timezone (default: UTC)"),
});

export const calculateSchema = z.object({
  expression: z.string().describe("Mathematical expression to calculate"),
});

export const searchWebSchema = z.object({
  query: z.string().describe("Search query"),
  maxResults: z.number().optional().default(5),
});

// ブラウザセッション関連スキーマ
export const startBrowserSessionSchema = z.object({
  sessionId: z.string().describe("Unique session ID for the browser session"),
});

export const getBrowserSessionStatusSchema = z.object({
  sessionId: z.string().describe("Session ID to check status for"),
});

export const closeBrowserSessionSchema = z.object({
  sessionId: z.string().describe("Session ID to close"),
});

// 最終回答フォーマット用スキーマ
export const formatFinalAnswerSchema = z.object({
  answer: z.string().describe("Final answer content to format for the user"),
  title: z.string().optional().describe("Optional short title for the answer"),
}); 