import React from "react";
import { BrowserView } from "./browser-view";
import { CodeView } from "./code-view";
import { FileTreeView } from "./file-tree-view";
import { TodoListView } from "./todo-list-view";
import { BrowserStep } from "@/app/types";

interface SidePanelProps {
  sessionUrl: string | null;
  isFinished: boolean;
  steps: BrowserStep[];
}

export function SidePanel({ sessionUrl, isFinished, steps }: SidePanelProps) {
  const lastStep = steps[steps.length - 1];
  const toolResult = lastStep?.toolResult as Record<string, unknown> | undefined;

  // Priority order: code -> file tree -> todo list -> browser
  if (toolResult) {
    if (typeof toolResult.code === "string") {
      return <CodeView code={toolResult.code as string} language={toolResult.language as string | undefined} />;
    }
    if (typeof toolResult.content === "string") {
      return <CodeView code={toolResult.content as string} language={inferLanguageFromPath(toolResult.path as string | undefined)} />;
    }
    if (Array.isArray(toolResult.files)) {
      return <FileTreeView entries={toolResult.files as Array<{ name: string; type: "file" | "directory"; size?: number | null; lastModified?: string | Date; }>} directoryPath={toolResult.path as string | undefined} />;
    }
    if (Array.isArray(toolResult.todos)) {
      return <TodoListView todos={toolResult.todos as Array<{ id: string; title: string; status: "pending" | "completed"; priority: "low" | "medium" | "high"; dueDate?: string | null; }>} />;
    }
  }

  // Default to browser view
  return <BrowserView sessionUrl={sessionUrl} isFinished={isFinished} />;
}

function inferLanguageFromPath(path?: string): string {
  if (!path) return "";
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py":
      return "python";
    case "js":
      return "javascript";
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "jsx":
      return "jsx";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "";
  }
} 