"use client";

import { motion } from "framer-motion";
import { Message } from "@/app/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: Message;
  className?: string;
}

export function MessageBubble({ message, className }: MessageBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex",
        message.role === 'user' ? 'justify-end' : 'justify-start',
        className
      )}
    >
      <div
        className={cn(
          "max-w-[80%] p-4 rounded-lg font-ppsupply",
          message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border text-card-foreground'
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.metadata && (
          <div className="text-xs opacity-70 mt-2">
            Model: {message.metadata.model}
          </div>
        )}
      </div>
    </motion.div>
  );
}