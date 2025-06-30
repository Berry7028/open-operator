import { systemPrompts, SystemPromptOptions } from './system-prompts';

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const {
    goal,
    language,
    selectedTools,
    availableTools,
    currentUrl,
    previousSteps,
    loopPreventionGuidance = '',
    shouldUseBrowser
  } = options;

  const prompt = systemPrompts[language];
  
  // ツール利用可能リストを構築
  const toolsStatusList = availableTools.map(tool => 
    `- ${tool.name}: ${tool.name === 'format_final_answer' || selectedTools.includes(tool.name) ? 'enabled: true' : 'enabled: false'}`
  );

  const toolsDescription = `\n\nTOOL AVAILABILITY LIST (enabled = can use):\n${toolsStatusList.join('\n')}

RULES FOR USING TOOLS:
1. ONLY use tools with enabled: true.
2. If the user requests a tool with enabled: false, respond with a brief apology and explain that the tool is not available in the current session. Do NOT attempt to use it.`;

  // コンテキストセクション
  const contextSection = shouldUseBrowser 
    ? `Current web page context (URL: ${currentUrl || 'unknown'})`
    : 'Working with local tools and files';

  // 前のステップセクション
  const previousStepsSection = previousSteps.length > 0
    ? `Previous steps taken:
${previousSteps
  .map((step, index) => `
Step ${index + 1}:
- Action: ${step.action}
- Result: ${step.result}
- Tool Used: ${step.tool || 'Unknown'}
${step.timestamp ? `- Timestamp: ${step.timestamp}` : ''}
`)
  .join("\n")}`
    : "";

  // アクションセクション
  const actionSection = `Determine the immediate next step to achieve the goal.

${shouldUseBrowser ? prompt.actions.browser : prompt.actions.local}
- ${prompt.actions.breakdown}
- ${prompt.actions.prioritize}
- ${prompt.actions.navigate}`;

  // プロンプトを構築
  const finalPrompt = prompt.main
    .replace('{goal}', goal)
    .replace('{loopPreventionGuidance}', loopPreventionGuidance)
    .replace('{contextSection}', contextSection)
    .replace('{previousStepsSection}', previousStepsSection)
    .replace('{actionSection}', actionSection)
    .replace('{toolsDescription}', toolsDescription);

  return finalPrompt;
}

export function buildLoopPreventionGuidance(
  recentTools: string[], 
  lastTool: string, 
  actualSameCount: number,
  previousExtraction?: string | Record<string, unknown>[],
  language: 'ja' | 'en' = 'ja'
): string {
  if (actualSameCount < 2) return '';

  const guidance = language === 'ja' ? {
    title: '⚠️ 重要: ループ防止通知',
    message: `同じ"${lastTool}"ツールを${actualSameCount}回連続で使用しています。ループに陥っている可能性があります。`,
    actions: [
      `前回の${actualSameCount}回の試行結果を慎重に確認してください`,
      '前回の結果が成功していた場合、同じツールを繰り返さず次の論理的なステップに進んでください',
      '前回の結果が失敗していた場合、異なるアプローチまたはツールを試してください',
      'ユーザーの質問に答えるのに十分な情報がある場合は、"format_final_answer"ツールをすぐに使用してください',
      '同じツールを繰り返し使用するのは、特定の理由と異なるパラメータがある場合のみにしてください'
    ],
    history: `前回のツール使用履歴: ${recentTools.reverse().join(' → ')}`,
    result: previousExtraction ? `最新の結果: ${JSON.stringify(previousExtraction, null, 2)}` : ''
  } : {
    title: '⚠️ IMPORTANT LOOP PREVENTION NOTICE',
    message: `You have used the "${lastTool}" tool ${actualSameCount} times in a row. This suggests you may be stuck in a loop.`,
    actions: [
      `CAREFULLY REVIEW the results from your previous ${actualSameCount} attempts`,
      'If the previous results were successful, do NOT repeat the same tool - move to the next logical step',
      'If the previous results failed, try a DIFFERENT approach or tool',
      'If you have sufficient information to answer the user\'s question, use "format_final_answer" tool immediately',
      'Only repeat the same tool if you have a SPECIFIC reason and different parameters'
    ],
    history: `Previous tool usage: ${recentTools.reverse().join(' → ')}`,
    result: previousExtraction ? `Latest result: ${JSON.stringify(previousExtraction, null, 2)}` : ''
  };

  return `

${guidance.title}:
${guidance.message}

REQUIRED ACTIONS:
${guidance.actions.map((action, i) => `${i + 1}. ${action}`).join('\n')}

${guidance.history}
${guidance.result}`;
}

export function analyzeToolUsageForLoop(previousSteps: Array<{
  action: string;
  result: string;
  timestamp?: string;
  tool?: string;
}>): {
  recentTools: string[];
  lastTool: string;
  actualSameCount: number;
} {
  const toolUsageHistory = previousSteps.map(step => ({ tool: step.tool || 'Unknown', action: step.action }));
  const recentTools = toolUsageHistory.slice(-5).map(h => h.tool);
  const lastTool = recentTools[recentTools.length - 1];
  const sameToolCount = recentTools.reverse().findIndex(tool => tool !== lastTool);
  const actualSameCount = sameToolCount === -1 ? recentTools.length : sameToolCount;

  return {
    recentTools,
    lastTool,
    actualSameCount
  };
} 