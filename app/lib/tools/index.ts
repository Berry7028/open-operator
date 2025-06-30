import { AgentTool } from "./types";
import { browserTools } from "./browser-tools";
import { filesystemTools } from "./filesystem-tools";
import { programmingTools } from "./programming-tools";
import { productivityTools } from "./productivity-tools";
import { utilityTools } from "./utility-tools";

// すべてのツールを統合
export const availableTools: AgentTool[] = [
  ...browserTools,
  ...filesystemTools,
  ...programmingTools,
  ...productivityTools,
  ...utilityTools,
];

// ツール実行関数
export async function executeAgentTool(
  toolName: string, 
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const tool = availableTools.find(t => t.name === toolName);
  
  if (!tool) {
    return {
      success: false,
      error: `Tool "${toolName}" not found`,
      availableTools: availableTools.map(t => t.name),
      suggestion: `利用可能なツール: ${availableTools.map(t => t.name).join(', ')}`
    };
  }

  try {
    // パラメータをバリデーション
    const validatedParams = tool.parameters.parse(params);
    
    // ツールを実行
    const result = await tool.execute(validatedParams);
    
    return {
      toolName: tool.name,
      category: tool.category,
      ...result,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to execute tool "${toolName}": ${error}`,
      toolName: tool.name,
      category: tool.category,
    };
  }
}

// カテゴリ別にツールを取得
export function getToolsByCategory(): Record<string, AgentTool[]> {
  const toolsByCategory: Record<string, AgentTool[]> = {};
  
  for (const tool of availableTools) {
    if (!toolsByCategory[tool.category]) {
      toolsByCategory[tool.category] = [];
    }
    toolsByCategory[tool.category].push(tool);
  }
  
  return toolsByCategory;
}

// 利用可能なカテゴリを取得
export function getToolCategories(): string[] {
  const categories = new Set(availableTools.map(tool => tool.category));
  return Array.from(categories).sort();
}

// 型とスキーマの再エクスポート
export * from "./types";
export * from "./schemas";

// ヘルパー関数の再エクスポート
export * from "./helpers/session-manager";
export * from "./helpers/file-utils";
export * from "./helpers/todo-utils"; 