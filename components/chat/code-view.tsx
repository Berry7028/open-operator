import React from "react";

interface CodeViewProps {
  code: string;
  language?: string;
}

export function CodeView({ code, language = "" }: CodeViewProps) {
  return (
    <div className="w-1/2 border-l border-border bg-card overflow-y-auto">
      <div className="h-full flex flex-col">
        <div className="bg-muted border-b border-border p-2 flex items-center justify-between">
          <span className="text-xs font-ppsupply text-muted-foreground">
            {language.toUpperCase() || "CODE"}
          </span>
        </div>
        <pre className="flex-1 p-4 text-sm font-mono whitespace-pre overflow-auto">
          {code}
        </pre>
      </div>
    </div>
  );
} 