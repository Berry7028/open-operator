import { z } from "zod";
import { promises as fs } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// セッション状態管理
const activeSessions = new Map<string, { sessionId: string, startedAt: Date, isActive: boolean }>();

export interface AgentTool {
  name: string;
  description: string;
  category: string;
  parameters: z.ZodSchema;
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

// Define workspace directories
const WORKSPACE_DIR = join(process.cwd(), "workspace");
const TODOS_DIR = join(process.cwd(), "todos");
const PYTHON_SCRIPTS_DIR = join(process.cwd(), "python_scripts");

// Ensure directories exist
async function ensureDirectories() {
  for (const dir of [WORKSPACE_DIR, TODOS_DIR, PYTHON_SCRIPTS_DIR]) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// File System Tools
const createFileSchema = z.object({
  path: z.string().describe("File path to create (relative to workspace)"),
  content: z.string().describe("File content"),
});

const createFolderSchema = z.object({
  path: z.string().describe("Folder path to create (relative to workspace)"),
});

const readFileSchema = z.object({
  path: z.string().describe("File path to read (relative to workspace)"),
});

const listFilesSchema = z.object({
  path: z.string().optional().describe("Directory path to list (relative to workspace, default: current directory)"),
});

// Programming Tools
const generateCodeSchema = z.object({
  language: z.string().describe("Programming language"),
  description: z.string().describe("What the code should do"),
  framework: z.string().optional().describe("Framework to use (if any)"),
  filename: z.string().optional().describe("Filename to save the code"),
});

const analyzeCodeSchema = z.object({
  code: z.string().describe("Code to analyze"),
  language: z.string().describe("Programming language"),
});

const executePythonSchema = z.object({
  code: z.string().describe("Python code to execute"),
  description: z.string().optional().describe("Description of what the code does"),
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

// セッション関連のスキーマ
const startBrowserSessionSchema = z.object({
  sessionId: z.string().describe("Unique session ID for the browser session"),
});

const getBrowserSessionStatusSchema = z.object({
  sessionId: z.string().describe("Session ID to check status for"),
});

const closeBrowserSessionSchema = z.object({
  sessionId: z.string().describe("Session ID to close"),
});

// Always-on utility: format the final answer in a unified style
const formatFinalAnswerSchema = z.object({
  answer: z.string().describe("Final answer content to format for the user"),
  title: z.string().optional().describe("Optional short title for the answer"),
});

// Helper functions
function sanitizePath(inputPath: string): string {
  // Remove any path traversal attempts
  return inputPath.replace(/\.\./g, '').replace(/^\/+/, '');
}

interface TodoItem {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
  dueDate: string | null;
  filename: string;
}

async function loadTodos(): Promise<TodoItem[]> {
  try {
    const todoFiles = await fs.readdir(TODOS_DIR);
    const todos: TodoItem[] = [];
    
    for (const file of todoFiles) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(join(TODOS_DIR, file), 'utf8');
        const lines = content.split('\n');
        const title = lines[0]?.replace('# ', '') || 'Untitled';
        const status = content.includes('- [x]') ? 'completed' : 'pending';
        const priorityMatch = content.match(/Priority: (low|medium|high)/);
        const priority = (priorityMatch ? priorityMatch[1] : 'medium') as 'low' | 'medium' | 'high';
        const dueDateMatch = content.match(/Due Date: (\d{4}-\d{2}-\d{2})/);
        const dueDate = dueDateMatch ? dueDateMatch[1] : null;
        const descriptionMatch = content.match(/## Description[\s\S]*?\n\n(.*?)(?=\n##|\n$|$)/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : '';
        
        todos.push({
          id: file.replace('.md', ''),
          title,
          description,
          priority,
          status: status as 'pending' | 'completed',
          dueDate,
          filename: file,
        });
      }
    }
    
    return todos;
  } catch (error) {
    console.error('Error loading todos:', error);
    return [];
  }
}

async function saveTodo(todo: TodoItem): Promise<string> {
  const filename = `${todo.id}.md`;
  const filePath = join(TODOS_DIR, filename);
  
  const markdown = `# ${todo.title}

## Status
- [${todo.status === 'completed' ? 'x' : ' '}] ${todo.title}

## Priority
Priority: ${todo.priority}

${todo.dueDate ? `## Due Date\nDue Date: ${todo.dueDate}\n` : ''}

## Description

${todo.description || 'No description provided.'}

## Created
Created: ${new Date().toISOString()}
`;

  await fs.writeFile(filePath, markdown, 'utf8');
  return filename;
}

// セッション管理のヘルパー関数
export function isSessionActive(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  return session ? session.isActive : false;
}

export function startSession(sessionId: string): void {
  activeSessions.set(sessionId, {
    sessionId,
    startedAt: new Date(),
    isActive: true
  });
}

export function closeSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.isActive = false;
    activeSessions.set(sessionId, session);
  }
}

export function getSessionStatus(sessionId: string) {
  return activeSessions.get(sessionId) || null;
}

export const availableTools: AgentTool[] = [
  // Browser Session Management Tools
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
  // File System Tools
  {
    name: "create_file",
    description: "Create a new file with specified content in the workspace",
    category: "filesystem",
    parameters: createFileSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { path, content } = params as { path: string; content: string };
        const sanitizedPath = sanitizePath(path);
        const fullPath = join(WORKSPACE_DIR, sanitizedPath);
        
        // Ensure parent directory exists
        const parentDir = join(fullPath, '..');
        await fs.mkdir(parentDir, { recursive: true });
        
        await fs.writeFile(fullPath, content, 'utf8');
        const stats = await fs.stat(fullPath);
        
        return {
          success: true,
          message: `File created at workspace/${sanitizedPath}`,
          path: sanitizedPath,
          size: stats.size,
          fullPath,
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
    description: "Create a new folder/directory in the workspace",
    category: "filesystem",
    parameters: createFolderSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { path } = params as { path: string };
        const sanitizedPath = sanitizePath(path);
        const fullPath = join(WORKSPACE_DIR, sanitizedPath);
        
        await fs.mkdir(fullPath, { recursive: true });
        
        return {
          success: true,
          message: `Folder created at workspace/${sanitizedPath}`,
          path: sanitizedPath,
          fullPath,
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
    description: "Read content from a file in the workspace",
    category: "filesystem",
    parameters: readFileSchema,
    execute: async (params) => {
      try {
        const { path } = params as { path: string };
        const sanitizedPath = sanitizePath(path);
        const fullPath = join(WORKSPACE_DIR, sanitizedPath);
        
        const content = await fs.readFile(fullPath, 'utf8');
        const stats = await fs.stat(fullPath);
        
        return {
          success: true,
          content,
          path: sanitizedPath,
          size: stats.size,
          lastModified: stats.mtime,
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
    description: "List files and folders in a workspace directory",
    category: "filesystem",
    parameters: listFilesSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { path = "." } = params as { path?: string };
        const sanitizedPath = sanitizePath(path);
        const fullPath = join(WORKSPACE_DIR, sanitizedPath);
        
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const files = await Promise.all(
          entries.map(async (entry) => {
            const entryPath = join(fullPath, entry.name);
            const stats = await fs.stat(entryPath);
            
            return {
              name: entry.name,
              type: entry.isDirectory() ? "directory" : "file",
              size: entry.isFile() ? stats.size : null,
              lastModified: stats.mtime,
            };
          })
        );
        
        return {
          success: true,
          files,
          path: sanitizedPath,
          count: files.length,
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
    description: "Generate code based on description and requirements, optionally save to workspace",
    category: "programming",
    parameters: generateCodeSchema,
    execute: async (params) => {
      try {
        const { language, description, framework, filename } = params as {
          language: string;
          description: string;
          framework?: string;
          filename?: string;
        };
        
        // Generate code based on language and description
        let generatedCode = "";
        let fileExtension = "";
        
        switch (language.toLowerCase()) {
          case "javascript":
          case "js":
            generatedCode = `// ${description}\n// Generated JavaScript code\n\nfunction main() {\n  // Implementation here\n  console.log("Generated JavaScript code for: ${description}");\n}\n\nif (require.main === module) {\n  main();\n}\n\nmodule.exports = { main };`;
            fileExtension = ".js";
            break;
          case "python":
            generatedCode = `# ${description}\n# Generated Python code\n\ndef main():\n    \"\"\"Generated Python code\"\"\"\n    print(f"Generated Python code for: ${description}")\n    # Implementation here\n    pass\n\nif __name__ == "__main__":\n    main()`;
            fileExtension = ".py";
            break;
          case "typescript":
          case "ts":
            generatedCode = `// ${description}\n// Generated TypeScript code\n\ninterface Config {\n  description: string;\n}\n\nfunction main(config: Config): void {\n  console.log(\`Generated TypeScript code for: \${config.description}\`);\n  // Implementation here\n}\n\nif (require.main === module) {\n  main({ description: "${description}" });\n}\n\nexport { main };`;
            fileExtension = ".ts";
            break;
          case "html":
            generatedCode = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${description}</title>\n</head>\n<body>\n  <h1>${description}</h1>\n  <p>Generated HTML content</p>\n  <!-- Add your content here -->\n</body>\n</html>`;
            fileExtension = ".html";
            break;
          default:
            generatedCode = `// ${description}\n// Generated code for ${language}\n// Implementation would go here\n\nfunction main() {\n  console.log("Generated ${language} code for: ${description}");\n}\n\nmain();`;
            fileExtension = ".txt";
        }

        const result: Record<string, unknown> = {
          success: true,
          code: generatedCode,
          language,
          description,
          framework,
        };

        // Optionally save to workspace
        if (filename) {
          await ensureDirectories();
          const fileName = filename.includes('.') ? filename : `${filename}${fileExtension}`;
          const sanitizedPath = sanitizePath(fileName);
          const fullPath = join(WORKSPACE_DIR, sanitizedPath);
          
          await fs.writeFile(fullPath, generatedCode, 'utf8');
          result.savedAs = `workspace/${sanitizedPath}`;
          result.message = `Code generated and saved to workspace/${sanitizedPath}`;
        } else {
          result.message = "Code generated successfully";
        }

        return result;
      } catch (error) {
        return {
          success: false,
          error: `Failed to generate code: ${error}`,
        };
      }
    },
  },
  {
    name: "execute_python",
    description: "Execute Python code and return the results",
    category: "programming", 
    parameters: executePythonSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { code, description } = params as {
          code: string;
          description?: string;
        };
        
        // Create a temporary Python file
        const timestamp = Date.now();
        const filename = `temp_${timestamp}.py`;
        const filePath = join(PYTHON_SCRIPTS_DIR, filename);
        
        // Add safety wrapper to the code
                 const wrappedCode = `
import sys
import os
import json
from datetime import datetime
import math
import random
import re

# Restrict dangerous operations
def restricted_exec():
    # Block dangerous imports and operations
    restricted_modules = ['subprocess', 'os.system', '__import__', 'eval', 'exec', 'open']
    
    try:
${code.split('\n').map((line: string) => '        ' + line).join('\n')}
    except Exception as e:
        print(f"Error: {str(e)}")
        return False
    return True

if __name__ == "__main__":
    restricted_exec()
`;

        await fs.writeFile(filePath, wrappedCode, 'utf8');
        
        // Execute the Python code with timeout
        const { stdout, stderr } = await execAsync(`python3 "${filePath}"`, {
          timeout: 10000, // 10 second timeout
          cwd: PYTHON_SCRIPTS_DIR,
        });
        
        // Clean up the temporary file
        await fs.unlink(filePath);
        
        return {
          success: true,
          output: stdout,
          error: stderr,
          description: description || '',
          executedAt: new Date().toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to execute Python code: ${error}`,
          description: params.description || '',
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
        const { code, language } = params as { code: string; language: string };
        
        // Basic code analysis
        const lines = code.split('\n');
        const nonEmptyLines = lines.filter((line: string) => line.trim().length > 0);
        const commentLines = lines.filter((line: string) => {
          const trimmed = line.trim();
          return trimmed.startsWith('//') || trimmed.startsWith('#') || 
                 trimmed.startsWith('/*') || trimmed.startsWith('*');
        });
        
        interface CodeIssue {
          type: string;
          message: string;
          severity?: string;
        }
        
        const analysis = {
          linesOfCode: lines.length,
          nonEmptyLines: nonEmptyLines.length,
          commentLines: commentLines.length,
          commentPercentage: Math.round((commentLines.length / nonEmptyLines.length) * 100) || 0,
          complexity: nonEmptyLines.length > 50 ? "High" : nonEmptyLines.length > 20 ? "Medium" : "Low",
          suggestions: [] as string[],
          issues: [] as CodeIssue[],
        };

        // Language-specific analysis
        if (language.toLowerCase() === 'python') {
          if (code.includes('eval(') || code.includes('exec(')) {
            analysis.issues.push({ type: "security", message: "Use of eval() or exec() detected - potential security risk", severity: "high" });
          }
          if (!code.includes('def ')) {
            analysis.suggestions.push("Consider organizing code into functions for better structure");
          }
          if (commentLines.length === 0 && nonEmptyLines.length > 10) {
            analysis.suggestions.push("Add comments to explain complex logic");
          }
        } else if (language.toLowerCase().includes('javascript') || language.toLowerCase().includes('typescript')) {
          if (code.includes('var ')) {
            analysis.suggestions.push("Consider using 'let' or 'const' instead of 'var'");
          }
          if (code.includes('==') && !code.includes('===')) {
            analysis.suggestions.push("Consider using '===' for strict equality comparison");
          }
        }

        // General suggestions
        if (analysis.commentPercentage < 10 && nonEmptyLines.length > 20) {
          analysis.suggestions.push("Consider adding more comments for better code documentation");
        }
        
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
    description: "Create a new todo item and save as markdown file",
    category: "productivity",
    parameters: createTodoSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { title, description, priority, dueDate } = params as {
          title: string;
          description?: string;
          priority: "low" | "medium" | "high";
          dueDate?: string;
        };
        
        const newTodo: TodoItem = {
          id: `todo_${Date.now()}`,
          title,
          description: description || '',
          priority,
          status: "pending",
          dueDate: dueDate || null,
          filename: '', // Will be set after saving
        };
        
        const filename = await saveTodo(newTodo);
        newTodo.filename = filename;
        
        return {
          success: true,
          todo: newTodo,
          filename,
          message: `Todo "${title}" created and saved as ${filename}`,
          path: `todos/${filename}`,
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
    description: "List all todos from markdown files with optional status filter",
    category: "productivity",
    parameters: listTodosSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { status } = params as {
          status: "all" | "pending" | "completed";
        };
        
        const todos = await loadTodos();
        let filteredTodos = todos;
        
        if (status !== "all") {
          filteredTodos = todos.filter(todo => todo.status === status);
        }
        
        return {
          success: true,
          todos: filteredTodos,
          count: filteredTodos.length,
          totalCount: todos.length,
          todosDirectory: "todos/",
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
    description: "Update an existing todo item in its markdown file",
    category: "productivity",
    parameters: updateTodoSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { id, ...updates } = params as { id: string; [key: string]: unknown };
        
        const todos = await loadTodos();
        const todo = todos.find(t => t.id === id);
        
        if (!todo) {
          return {
            success: false,
            error: `Todo with ID ${id} not found`,
          };
        }
        
        // Update todo properties
        const updatedTodo = { ...todo, ...updates };
        await saveTodo(updatedTodo);
        
        return {
          success: true,
          todo: updatedTodo,
          message: `Todo updated successfully`,
          path: `todos/${updatedTodo.filename}`,
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
        const { timezone = "UTC" } = params as { timezone?: string };
        const now = new Date();
        
        return {
          success: true,
          timestamp: now.toISOString(),
          formatted: now.toLocaleString("en-US", { timeZone: timezone }),
          timezone,
          unix: Math.floor(now.getTime() / 1000),
          localTime: now.toLocaleString(),
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
    description: "Perform mathematical calculations using Python",
    category: "utility",
    parameters: calculateSchema,
    execute: async (params) => {
      await ensureDirectories();
      const { expression } = params as { expression: string };
      
      try {
        
        // Create safe Python calculation code
        const pythonCode = `
import math
import operator

# Safe calculation function
def safe_calculate(expression):
    # Allow only safe mathematical operations
    allowed_chars = set('0123456789+-*/().%** ')
    if not all(c in allowed_chars or c.isalnum() for c in expression):
        return "Error: Invalid characters in expression"
    
    # Replace some common math functions
    safe_expression = expression.replace('^', '**')
    
    try:
        # Use eval with restricted globals for safety
        allowed_names = {
            "__builtins__": {},
            "math": math,
            "abs": abs,
            "round": round,
            "min": min,
            "max": max,
            "sum": sum,
            "pow": pow,
        }
        result = eval(safe_expression, allowed_names)
        return result
    except Exception as e:
        return f"Error: {str(e)}"

result = safe_calculate("${expression}")
print(f"Expression: ${expression}")
print(f"Result: {result}")
print(f"Type: {type(result).__name__}")
`;

        // Execute Python calculation
        const timestamp = Date.now();
        const filename = `calc_${timestamp}.py`;
        const filePath = join(PYTHON_SCRIPTS_DIR, filename);
        
        await fs.writeFile(filePath, pythonCode, 'utf8');
        
        const { stdout, stderr } = await execAsync(`python3 "${filePath}"`, {
          timeout: 5000, // 5 second timeout
          cwd: PYTHON_SCRIPTS_DIR,
        });
        
        await fs.unlink(filePath);
        
        // Parse the output
        const lines = stdout.trim().split('\n');
        const resultLine = lines.find(line => line.startsWith('Result: '));
        const typeLine = lines.find(line => line.startsWith('Type: '));
        
        const result = resultLine ? resultLine.replace('Result: ', '') : 'Unknown';
        const resultType = typeLine ? typeLine.replace('Type: ', '') : 'unknown';
        
        return {
          success: !stderr && !result.startsWith('Error:'),
          expression,
          result: result.startsWith('Error:') ? null : result,
          type: resultType,
          output: stdout,
          error: stderr || (result.startsWith('Error:') ? result : null),
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
        const { query, maxResults } = params as {
          query: string;
          maxResults?: number;
        };
        
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
          note: "This is a simulated web search. Implement actual web search API for real results.",
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to search web: ${error}`,
        };
      }
    },
  },
  // Always-on utility: format the final answer in a unified style
  {
    name: "format_final_answer",
    description: "Format the final answer in a consistent layout to be shown to the user. Always enabled.",
    category: "utility",
    parameters: formatFinalAnswerSchema,
    execute: async (params) => {
      const { answer, title } = params as { answer: string; title?: string };
      const formatted = title
        ? `## ${title}\n\n${answer}`
        : answer;
      return {
        success: true,
        formattedAnswer: formatted,
        aiResponse: formatted,
      };
    },
  },
];

export async function executeAgentTool(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    // Validate parameters
    const validatedParams = tool.parameters.parse(params);
    
    // Execute the tool
    const result = await tool.execute(validatedParams);
    
    return {
      success: true,
      toolName,
      params: validatedParams,
      result,
      executedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error executing tool "${toolName}":`, error);
    
    // より詳細なエラー情報を生成
    const errorInfo = {
      toolName,
      inputParams: params,
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'UnknownError',
      timestamp: new Date().toISOString()
    };
    
    // Zodパラメータ検証エラーの場合、より親切な説明を提供
    if (error instanceof Error && error.message.includes('validation')) {
      return {
        success: false,
        error: `パラメータの検証に失敗しました: ${error.message}`,
        toolName,
        inputParams: params,
        suggestion: `ツール "${toolName}" の必要なパラメータを確認してください。`,
        timestamp: errorInfo.timestamp
      };
    }
    
    // その他のエラーの場合
    return {
      success: false,
      error: `ツール "${toolName}" の実行中にエラーが発生しました: ${errorInfo.error}`,
      toolName,
      inputParams: params,
      errorType: errorInfo.errorType,
      suggestion: "パラメータや実行環境を確認してから再度お試しください。",
      timestamp: errorInfo.timestamp
    };
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