import React from "react";

interface FileEntry {
  name: string;
  type: "file" | "directory";
  size?: number | null;
  lastModified?: string | Date;
}

interface FileTreeViewProps {
  entries: FileEntry[];
  directoryPath?: string;
}

export function FileTreeView({ entries, directoryPath = "" }: FileTreeViewProps) {
  return (
    <div className="w-1/2 border-l border-border bg-card overflow-y-auto">
      <div className="h-full flex flex-col">
        <div className="bg-muted border-b border-border p-2">
          <span className="text-xs font-ppsupply text-muted-foreground">
            {directoryPath || "FILES"}
          </span>
        </div>
        <ul className="flex-1 p-4 text-sm font-ppsupply space-y-1">
          {entries.map((entry) => (
            <li key={entry.name} className="flex items-center gap-2">
              <span>{entry.type === "directory" ? "📁" : "📄"}</span>
              <span>{entry.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
} 