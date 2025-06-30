import React from "react";

interface TodoItem {
  id: string;
  title: string;
  status: "pending" | "completed";
  priority: "low" | "medium" | "high";
  dueDate?: string | null;
}

interface TodoListViewProps {
  todos: TodoItem[];
}

export function TodoListView({ todos }: TodoListViewProps) {
  return (
    <div className="w-1/2 border-l border-border bg-card overflow-y-auto">
      <div className="h-full flex flex-col">
        <div className="bg-muted border-b border-border p-2">
          <span className="text-xs font-ppsupply text-muted-foreground">TO&nbsp;DO</span>
        </div>
        <ul className="flex-1 p-4 text-sm font-ppsupply space-y-1">
          {todos.map((todo) => (
            <li key={todo.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={todo.status === "completed"}
                readOnly
                className="accent-primary"
              />
              <span className={todo.status === "completed" ? "line-through" : ""}>{todo.title}</span>
              {todo.dueDate && (
                <span className="ml-auto text-xs text-muted-foreground">{todo.dueDate}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 