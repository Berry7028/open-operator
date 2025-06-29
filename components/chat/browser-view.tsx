"use client";

import { CheckCircle } from "lucide-react";

interface BrowserViewProps {
  sessionUrl: string | null;
  isFinished: boolean;
}

export function BrowserView({ sessionUrl, isFinished }: BrowserViewProps) {
  if (!sessionUrl) return null;

  return (
    <div className="w-1/2 border-l border-border bg-card">
      <div className="h-full flex flex-col">
        {/* Browser Chrome */}
        <div className="bg-muted border-b border-border p-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1 text-muted-foreground hover:text-foreground">←</button>
            <button className="p-1 text-muted-foreground hover:text-foreground">→</button>
            <button className="p-1 text-muted-foreground hover:text-foreground">↻</button>
            <div className="flex-1 px-3 py-1 bg-background border border-border rounded text-sm text-muted-foreground">
              Browser Session
            </div>
          </div>
        </div>

        {/* Browser Content */}
        <div className="flex-1">
          {isFinished ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-muted-foreground font-ppsupply">Task completed successfully!</p>
              </div>
            </div>
          ) : (
            <iframe
              src={sessionUrl}
              className="w-full h-full border-none"
              sandbox="allow-same-origin allow-scripts allow-forms"
              loading="lazy"
              referrerPolicy="no-referrer"
              title="Browser Session"
            />
          )}
        </div>
      </div>
    </div>
  );
}