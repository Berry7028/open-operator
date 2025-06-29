import { z } from "zod";
import { promises as fs } from "fs";
import { join } from "path";

export interface AgentTool {
  name: string;
  description: string;
  category: string;
  parameters: z.ZodSchema;
  execute: (params: any) => Promise<any>;
}

// File System Tools
const createFileSchema = z.object({
  path: z.string().describe("File path to create"),
  content: z.string().describe("File content"),
});

const createFolderSchema = z.object({
  path: z.string().describe("Folder path to create"),
});

const readFileSchema = z.object({
  path: z.string().describe("File path to read"),
});

const listFilesSchema = z.object({
  path: z.string().optional().describe("Directory path to list (default: current directory)"),
});

// Programming Tools
const generateCodeSchema = z.object({
  language: z.string().describe("Programming language"),
  description: z.string().describe("What the code should do"),
  framework: z.string().optional().describe("Framework to use (if any)"),
});

const analyzeCodeSchema = z.object({
  code: z.string().describe("Code to analyze"),
  language: z.string().describe("Programming language"),
});

// Todo Management Tools
const createTodoSchema = z.object({
  title: z.string().describe("Todo title"),
  description: z.string().optional().describe("Todo description"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().optional().describe("Due date (YYYY-MM-DD format)"),
});

const listTodosSchema = z.object({
  status: z.enum(["all", "pending", "completed"]).default("all"),
});

const updateTodoSchema = z.object({
  id: z.string().describe("Todo ID"),
  status: z.enum(["pending", "completed"]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

// Utility Tools
const getCurrentTimeSchema = z.object({
  timezone: z.string().optional().describe("Timezone (default: UTC)"),
});

const calculateSchema = z.object({
  expression: z.string().describe("Mathematical expression to calculate"),
});

const searchWebSchema = z.object({
  query: z.string().describe("Search query"),
  maxResults: z.number().optional().default(5),
});

// In-memory storage for todos (in production, use a database)
let todos: Array<{
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "pending" | "completed";
  createdAt: Date;
  dueDate?: Date;
}> = [];

export const availableTools: AgentTool[] = [
  // File System Tools
  {
    name: "create_file",
    description: "Create a new file with specified content",
    category: "filesystem",
    parameters: createFileSchema,
    execute: async (params) => {
      try {
        const { path, content } = params;
        // In a real implementation, you'd write to the actual file system
        // For demo purposes, we'll simulate file creation
        return {
          success: true,
          message: `File created at ${path}`,
          path,
          size: content.length,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create file: ${error}`,
        };
      }
    },
  },
  {
    name: "create_folder",
    description: "Create a new folder/directory",
    category: "filesystem",
    parameters: createFolderSchema,
    execute: async (params) => {
      try {
        const { path } = params;
        return {
          success: true,
          message: `Folder created at ${path}`,
          path,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create folder: ${error}`,
        };
      }
    },
  },
  {
    name: "read_file",
    description: "Read content from a file",
    category: "filesystem",
    parameters: readFileSchema,
    execute: async (params) => {
      try {
        const { path } = params;
        // Simulate file reading
        return {
          success: true,
          content: `// Simulated content of ${path}\n// This would contain the actual file content`,
          path,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to read file: ${error}`,
        };
      }
    },
  },
  {
    name: "list_files",
    description: "List files and folders in a directory",
    category: "filesystem",
    parameters: listFilesSchema,
    execute: async (params) => {
      try {
        const { path = "." } = params;
        // Simulate directory listing
        return {
          success: true,
          files: [
            { name: "package.json", type: "file", size: 1024 },
            { name: "src", type: "directory" },
            { name: "README.md", type: "file", size: 2048 },
          ],
          path,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list files: ${error}`,
        };
      }
    },
  },

  // Programming Tools
  {
    name: "generate_code",
    description: "Generate code based on description and requirements",
    category: "programming",
    parameters: generateCodeSchema,
    execute: async (params) => {
      try {
        const { language, description, framework } = params;
        
        // Simulate code generation based on language and description
        let generatedCode = "";
        
        switch (language.toLowerCase()) {
          case "javascript":
          case "js":
            generatedCode = `// ${description}\nfunction generatedFunction() {\n  // Implementation here\n  console.log("Generated JavaScript code");\n}\n\ngeneratedFunction();`;
            break;
          case "python":
            generatedCode = `# ${description}\ndef generated_function():\n    """Generated Python code"""\n    print("Generated Python code")\n    pass\n\nif __name__ == "__main__":\n    generated_function()`;
            break;
          case "typescript":
          case "ts":
            generatedCode = `// ${description}\ninterface GeneratedInterface {\n  id: string;\n  name: string;\n}\n\nfunction generatedFunction(): GeneratedInterface {\n  return {\n    id: "1",\n    name: "Generated TypeScript code"\n  };\n}`;
            break;
          default:
            generatedCode = `// ${description}\n// Generated code for ${language}\n// Implementation would go here`;
        }

        return {
          success: true,
          code: generatedCode,
          language,
          description,
          framework,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to generate code: ${error}`,
        };
      }
    },
  },
  {
    name: "analyze_code",
    description: "Analyze code for potential issues, improvements, and insights",
    category: "programming",
    parameters: analyzeCodeSchema,
    execute: async (params) => {
      try {
        const { code, language } = params;
        
        // Simulate code analysis
        const analysis = {
          linesOfCode: code.split('\n').length,
          complexity: "Medium",
          suggestions: [
            "Consider adding error handling",
            "Add type annotations for better code clarity",
            "Consider breaking down large functions",
          ],
          issues: [
            { type: "warning", message: "Unused variable detected", line: 5 },
            { type: "info", message: "Consider using const instead of let", line: 3 },
          ],
        };

        return {
          success: true,
          analysis,
          language,
          codeLength: code.length,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to analyze code: ${error}`,
        };
      }
    },
  },

  // Todo Management Tools
  {
    name: "create_todo",
    description: "Create a new todo item",
    category: "productivity",
    parameters: createTodoSchema,
    execute: async (params) => {
      try {
        const { title, description, priority, dueDate } = params;
        
        const newTodo = {
          id: Date.now().toString(),
          title,
          description,
          priority,
          status: "pending" as const,
          createdAt: new Date(),
          dueDate: dueDate ? new Date(dueDate) : undefined,
        };
        
        todos.push(newTodo);
        
        return {
          success: true,
          todo: newTodo,
          message: `Todo "${title}" created successfully`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create todo: ${error}`,
        };
      }
    },
  },
  {
    name: "list_todos",
    description: "List all todos with optional status filter",
    category: "productivity",
    parameters: listTodosSchema,
    execute: async (params) => {
      try {
        const { status } = params;
        
        let filteredTodos = todos;
        if (status !== "all") {
          filteredTodos = todos.filter(todo => todo.status === status);
        }
        
        return {
          success: true,
          todos: filteredTodos,
          count: filteredTodos.length,
          totalCount: todos.length,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to list todos: ${error}`,
        };
      }
    },
  },
  {
    name: "update_todo",
    description: "Update an existing todo item",
    category: "productivity",
    parameters: updateTodoSchema,
    execute: async (params) => {
      try {
        const { id, ...updates } = params;
        
        const todoIndex = todos.findIndex(todo => todo.id === id);
        if (todoIndex === -1) {
          return {
            success: false,
            error: `Todo with ID ${id} not found`,
          };
        }
        
        todos[todoIndex] = { ...todos[todoIndex], ...updates };
        
        return {
          success: true,
          todo: todos[todoIndex],
          message: `Todo updated successfully`,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to update todo: ${error}`,
        };
      }
    },
  },

  // Utility Tools
  {
    name: "get_current_time",
    description: "Get the current date and time",
    category: "utility",
    parameters: getCurrentTimeSchema,
    execute: async (params) => {
      try {
        const { timezone = "UTC" } = params;
        const now = new Date();
        
        return {
          success: true,
          timestamp: now.toISOString(),
          formatted: now.toLocaleString("en-US", { timeZone: timezone }),
          timezone,
          unix: Math.floor(now.getTime() / 1000),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to get current time: ${error}`,
        };
      }
    },
  },
  {
    name: "calculate",
    description: "Perform mathematical calculations",
    category: "utility",
    parameters: calculateSchema,
    execute: async (params) => {
      try {
        const { expression } = params;
        
        // Simple calculator - in production, use a proper math parser
        const sanitizedExpression = expression.replace(/[^0-9+\-*/().\s]/g, '');
        const result = eval(sanitizedExpression);
        
        return {
          success: true,
          expression,
          result,
          type: typeof result,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to calculate: ${error}`,
          expression,
        };
      }
    },
  },
  {
    name: "search_web",
    description: "Search the web for information (simulated)",
    category: "web",
    parameters: searchWebSchema,
    execute: async (params) => {
      try {
        const { query, maxResults } = params;
        
        // Simulate web search results
        const simulatedResults = [
          {
            title: `Search result for "${query}" - Example Site 1`,
            url: `https://example1.com/search?q=${encodeURIComponent(query)}`,
            snippet: `This is a simulated search result for the query "${query}". In a real implementation, this would contain actual search results.`,
          },
          {
            title: `${query} - Wikipedia`,
            url: `https://wikipedia.org/wiki/${encodeURIComponent(query)}`,
            snippet: `Wikipedia article about ${query}. This would contain relevant information from Wikipedia.`,
          },
          {
            title: `Latest news about ${query}`,
            url: `https://news.example.com/${encodeURIComponent(query)}`,
            snippet: `Recent news and updates related to ${query}. This would show current news articles.`,
          },
        ].slice(0, maxResults);
        
        return {
          success: true,
          query,
          results: simulatedResults,
          count: simulatedResults.length,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to search web: ${error}`,
        };
      }
    },
  },
];

export async function executeAgentTool(toolName: string, params: any): Promise<any> {
  const tool = availableTools.find(t => t.name === toolName);
  
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found`);
  }
  
  try {
    // Validate parameters
    const validatedParams = tool.parameters.parse(params);
    
    // Execute the tool
    const result = await tool.execute(validatedParams);
    
    return {
      toolName,
      params: validatedParams,
      result,
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to execute tool "${toolName}": ${error}`);
  }
}

export function getToolsByCategory() {
  const categories: Record<string, AgentTool[]> = {};
  
  availableTools.forEach(tool => {
    if (!categories[tool.category]) {
      categories[tool.category] = [];
    }
    categories[tool.category].push(tool);
  });
  
  return categories;
}

export function getToolCategories() {
  return [...new Set(availableTools.map(tool => tool.category))];
}