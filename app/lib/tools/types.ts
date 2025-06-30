import { z } from "zod";

export interface AgentTool {
  name: string;
  description: string;
  category: string;
  parameters: z.ZodSchema;
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface TodoItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  dueDate: string | null;
  filename: string;
}

export interface SessionInfo {
  sessionId: string;
  startedAt: Date;
  isActive: boolean;
}

export interface CodeIssue {
  type: string;
  message: string;
  severity?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
} 