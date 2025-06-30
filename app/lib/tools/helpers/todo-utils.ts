import { promises as fs } from "fs";
import { join } from "path";
import { TodoItem } from "../types";
import { WORKSPACE_DIR } from "./file-utils";

const TODOS_FILE = join(WORKSPACE_DIR, "todos.md");

interface TodoFile {
  todos: TodoItem[];
  metadata: {
    created: string;
    lastModified: string;
    version: string;
  };
}

export async function loadTodos(): Promise<TodoItem[]> {
  try {
    // Check if todos file exists
    try {
      await fs.access(TODOS_FILE);
    } catch {
      // File doesn't exist, create empty todos file
      await initializeTodosFile();
      return [];
    }

    const content = await fs.readFile(TODOS_FILE, 'utf8');
    
    // Parse the markdown todos file
    const todos: TodoItem[] = [];
    const lines = content.split('\n');
    
    let currentTodo: Partial<TodoItem> | null = null;
    let inDescription = false;
    let descriptionLines: string[] = [];
    
    for (const line of lines) {
      if (line.startsWith('### ')) {
        // Save previous todo if exists
        if (currentTodo) {
          currentTodo.description = descriptionLines.join('\n').trim();
          todos.push(currentTodo as TodoItem);
        }
        
        // Start new todo
        const titleMatch = line.match(/### (.+?) \(ID: (.+?)\)/);
        if (titleMatch) {
          currentTodo = {
            id: titleMatch[2],
            title: titleMatch[1],
            description: '',
            priority: 'medium',
            status: 'pending',
            dueDate: null,
            filename: 'todos.md',
          };
          descriptionLines = [];
          inDescription = false;
        }
      } else if (line.startsWith('- [')) {
        // Status line
        if (currentTodo) {
          currentTodo.status = line.includes('- [x]') ? 'completed' : 'pending';
        }
      } else if (line.startsWith('**Priority:**')) {
        // Priority line
        const priorityMatch = line.match(/\*\*Priority:\*\* (low|medium|high)/);
        if (currentTodo && priorityMatch) {
          currentTodo.priority = priorityMatch[1] as 'low' | 'medium' | 'high';
        }
      } else if (line.startsWith('**Due Date:**')) {
        // Due date line
        const dueDateMatch = line.match(/\*\*Due Date:\*\* (\d{4}-\d{2}-\d{2})/);
        if (currentTodo && dueDateMatch) {
          currentTodo.dueDate = dueDateMatch[1];
        }
      } else if (line.startsWith('**Description:**')) {
        inDescription = true;
      } else if (inDescription && line.trim() !== '' && !line.startsWith('---')) {
        descriptionLines.push(line);
      } else if (line.startsWith('---') && inDescription) {
        inDescription = false;
      }
    }
    
    // Save last todo
    if (currentTodo) {
      currentTodo.description = descriptionLines.join('\n').trim();
      todos.push(currentTodo as TodoItem);
    }
    
    return todos;
  } catch (error) {
    console.error('Error loading todos:', error);
    return [];
  }
}

export async function saveTodos(todos: TodoItem[]): Promise<void> {
  const content = generateTodosMarkdown(todos);
  await fs.writeFile(TODOS_FILE, content, 'utf8');
}

export async function saveTodo(todo: TodoItem): Promise<string> {
  const todos = await loadTodos();
  
  // Find and update existing todo or add new one
  const existingIndex = todos.findIndex(t => t.id === todo.id);
  if (existingIndex >= 0) {
    todos[existingIndex] = todo;
  } else {
    todos.push(todo);
  }
  
  await saveTodos(todos);
  return "todos.md";
}

async function initializeTodosFile(): Promise<void> {
  const content = generateTodosMarkdown([]);
  await fs.writeFile(TODOS_FILE, content, 'utf8');
}

function generateTodosMarkdown(todos: TodoItem[]): string {
  const now = new Date().toISOString();
  
  let content = `# Todo List

## Metadata
- **Created:** ${now}
- **Last Modified:** ${now}
- **Total Items:** ${todos.length}
- **Pending:** ${todos.filter(t => t.status === 'pending').length}
- **Completed:** ${todos.filter(t => t.status === 'completed').length}

---

`;

  if (todos.length === 0) {
    content += `## No todos yet

Add your first todo item to get started!

---
`;
  } else {
    // Group todos by status
    const pendingTodos = todos.filter(t => t.status === 'pending');
    const completedTodos = todos.filter(t => t.status === 'completed');
    
    if (pendingTodos.length > 0) {
      content += `## Pending Tasks (${pendingTodos.length})\n\n`;
      for (const todo of pendingTodos) {
        content += formatTodoMarkdown(todo);
      }
    }
    
    if (completedTodos.length > 0) {
      content += `## Completed Tasks (${completedTodos.length})\n\n`;
      for (const todo of completedTodos) {
        content += formatTodoMarkdown(todo);
      }
    }
  }
  
  return content;
}

function formatTodoMarkdown(todo: TodoItem): string {
  const checkbox = todo.status === 'completed' ? '[x]' : '[ ]';
  
  return `### ${todo.title} (ID: ${todo.id})

- ${checkbox} ${todo.title}
**Priority:** ${todo.priority}${todo.dueDate ? `\n**Due Date:** ${todo.dueDate}` : ''}

**Description:**
${todo.description || 'No description provided.'}

---

`;
} 