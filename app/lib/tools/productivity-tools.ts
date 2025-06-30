import { AgentTool } from "./types";
import { 
  createTodoSchema, 
  listTodosSchema, 
  updateTodoSchema 
} from "./schemas";
import { ensureDirectories } from "./helpers/file-utils";
import { loadTodos, saveTodo } from "./helpers/todo-utils";

export const productivityTools: AgentTool[] = [
  {
    name: "create_todo",
    description: "Create a new todo item with title, description, priority, and optional due date",
    category: "productivity",
    parameters: createTodoSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { title, description, priority, dueDate } = params as {
          title: string;
          description?: string;
          priority: 'low' | 'medium' | 'high';
          dueDate?: string;
        };
        
        const id = `todo_${Date.now()}`;
        const todo = {
          id,
          title,
          description: description || '',
          priority: priority || 'medium',
          status: 'pending' as const,
          dueDate: dueDate || null,
          filename: `${id}.md`,
        };
        
        const filename = await saveTodo(todo);
        
        return {
          success: true,
          todo,
          message: `Todo created successfully: "${title}"`,
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
    description: "List all todos or filter by status (all, pending, completed)",
    category: "productivity",
    parameters: listTodosSchema,
    execute: async (params) => {
      try {
        await ensureDirectories();
        const { status } = params as { status: 'all' | 'pending' | 'completed' };
        
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
]; 