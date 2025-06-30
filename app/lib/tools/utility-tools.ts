import { AgentTool } from "./types";
import { 
  getCurrentTimeSchema, 
  calculateSchema, 
  searchWebSchema, 
  formatFinalAnswerSchema 
} from "./schemas";

export const utilityTools: AgentTool[] = [
  {
    name: "get_current_time",
    description: "Get the current date and time",
    category: "utility",
    parameters: getCurrentTimeSchema,
    execute: async (params) => {
      try {
        const { timezone = "Asia/Tokyo" } = params as { timezone?: string };
        const now = new Date();
        
        // 東京時間の正確な取得
        const tokyoTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
        const formatTime = (date: Date, tz: string) => {
          return date.toLocaleString("ja-JP", { 
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
        };
        
        const requestedTime = timezone === "Asia/Tokyo" ? tokyoTime : 
                             new Date(now.toLocaleString("en-US", { timeZone: timezone }));
        
        return {
          success: true,
          timestamp: now.toISOString(),
          formatted: formatTime(requestedTime, timezone),
          timezone,
          unix: Math.floor(now.getTime() / 1000),
          localTime: formatTime(tokyoTime, "Asia/Tokyo"),
          currentDateTime: {
            year: tokyoTime.getFullYear(),
            month: tokyoTime.getMonth() + 1,
            day: tokyoTime.getDate(),
            hour: tokyoTime.getHours(),
            minute: tokyoTime.getMinutes(),
            second: tokyoTime.getSeconds(),
            weekday: tokyoTime.toLocaleDateString("ja-JP", { weekday: 'long' })
          }
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
      const { expression, description } = params as { expression: string; description?: string };
      
      try {
        // 基本的な数学演算のみを安全に実行
        const safeExpression = expression
          .replace(/\^/g, '**')  // べき乗記号の変換
          .replace(/[^0-9+\-*/.() ]/g, ''); // 安全な文字のみ許可
        
        // JavaScriptのeval関数を制限付きで使用（基本演算のみ）
        const allowedChars = /^[0-9+\-*/.() ]*$/;
        if (!allowedChars.test(safeExpression)) {
          return {
            success: false,
            error: "不正な文字が含まれています。数字、+、-、*、/、(、)、.のみ使用可能です。",
            expression
          };
        }
        
        const result = Function(`"use strict"; return (${safeExpression})`)();
        
        if (typeof result !== 'number' || !isFinite(result)) {
          return {
            success: false,
            error: "計算結果が無効です",
            expression
          };
        }
        
        return {
          success: true,
          expression,
          result,
          formatted: result.toLocaleString("ja-JP"),
          description: description || `${expression}の計算結果`,
          calculation: {
            input: expression,
            output: result,
            type: "number"
          }
        };
      } catch (error) {
        return {
          success: false,
          error: `計算エラー: ${error}`,
          expression,
          suggestion: "式を確認してください。例: 1000 * (1 + 0.05) ** 10"
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