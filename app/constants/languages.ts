export const languages = {
  ja: {
    // Settings Modal
    settings: '設定',
    llmProviders: 'LLMプロバイダー',
    general: '一般',
    llmProviderConfiguration: 'LLMプロバイダー設定',
    llmProviderConfigurationDesc: '異なるLLMプロバイダーのAPIキーと設定を構成します。',
    configured: '設定済み',
    notConfigured: '未設定',
    enabled: '有効',
    test: 'テスト',
    testing: 'テスト中...',
    defaultModel: 'デフォルトモデル',
    theme: 'テーマ',
    language: '言語',
    system: 'システム',
    light: 'ライト',
    dark: 'ダーク',
    japanese: '日本語 (Japanese)',
    english: 'English',
    autoSave: 'チャットセッションを自動保存',
    importExportSettings: '設定のインポート/エクスポート',
    exportSettings: '設定をエクスポート',
    importSettings: '設定をインポート',
    skipForNow: '今はスキップ',
    availableModels: '利用可能なモデル',
    
    // Chat Interface
    processingRequest: 'リクエストを処理中...',
    taskCompleted: 'タスクが完了しました！',
    taskCompletedDesc: '以下の目標を達成するために、{steps}ステップを正常に実行しました: "{goal}"',
    demoModeWarning: '⚠️ デモモードで実行中です。フルブラウザ自動化機能を使用するには、設定でBrowserbase APIキーを設定してください。',
    errorOccurred: '申し訳ございませんが、サポート中にエラーが発生しました。再度お試しください。',
    
    // Welcome Screen
    welcomeTitle: 'Open Operator',
    welcomeSubtitle: 'ウェブブラウジング、プログラミング、生産性向上のための強力なツールを備えたAIエージェント',
    welcomeDescription: 'Open Operatorを使って、ウェブブラウジング、ファイル操作、計算などの様々なタスクを自動化できます。何をお手伝いしましょうか？',
    getStarted: '始める',
    demoModeStatus: '🛠️ デモモード: フルブラウザ自動化にはBrowserbase設定が必要です',
    selectModel: 'モデル選択',
    selectTools: 'ツール選択',
    selectToolsDesc: 'エージェントが使用できるツールを選択してください。空にしておくとすべてのツールが使用可能です。',
    inputPlaceholder: '何をお手伝いしましょうか？',
    start: '開始',
    tryExamples: '以下の例を試してみてください：',
    poweredBy: 'Powered by',
    
    // General UI
    close: '閉じる',
    save: '保存',
    cancel: 'キャンセル',
    confirm: '確認',
    delete: '削除',
    edit: '編集',
    add: '追加',
    remove: '削除',
    
    // Error messages
    error: 'エラー',
    warning: '警告',
    success: '成功',
    info: '情報',
  },
  en: {
    // Settings Modal
    settings: 'Settings',
    llmProviders: 'LLM Providers',
    general: 'General',
    llmProviderConfiguration: 'LLM Provider Configuration',
    llmProviderConfigurationDesc: 'Configure your API keys and settings for different LLM providers.',
    configured: 'Configured',
    notConfigured: 'Not Configured',
    enabled: 'Enabled',
    test: 'Test',
    testing: 'Testing...',
    defaultModel: 'Default Model',
    theme: 'Theme',
    language: 'Language / 言語',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    japanese: '日本語 (Japanese)',
    english: 'English',
    autoSave: 'Auto-save chat sessions',
    importExportSettings: 'Import/Export Settings',
    exportSettings: 'Export Settings',
    importSettings: 'Import Settings',
    skipForNow: 'Skip for now',
    availableModels: 'Available models',
    
    // Chat Interface
    processingRequest: 'Processing your request...',
    taskCompleted: 'Task completed!',
    taskCompletedDesc: 'I\'ve successfully executed {steps} steps to help you with: "{goal}"',
    demoModeWarning: '⚠️ Running in demo mode. To use full browser automation features, please configure Browserbase API keys in settings.',
    errorOccurred: 'Sorry, I encountered an error while trying to help you. Please try again.',
    
    // Welcome Screen
    welcomeTitle: 'Open Operator',
    welcomeSubtitle: 'AI Agent with powerful tools for web browsing, programming, and productivity',
    welcomeDescription: 'Use Open Operator to automate various tasks including web browsing, file operations, calculations, and more. How can I help you today?',
    getStarted: 'Get Started',
    demoModeStatus: '🛠️ Demo Mode: Full browser automation requires Browserbase configuration',
    selectModel: 'Select Model',
    selectTools: 'Select Tools',
    selectToolsDesc: 'Choose which tools the agent can use. Leave empty to allow all tools.',
    inputPlaceholder: 'What would you like me to help you with?',
    start: 'Start',
    tryExamples: 'Try these examples:',
    poweredBy: 'Powered by',
    
    // General UI
    close: 'Close',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    remove: 'Remove',
    
    // Error messages
    error: 'Error',
    warning: 'Warning',
    success: 'Success',
    info: 'Info',
  },
} as const;

export type Language = keyof typeof languages;
export type LanguageKey = keyof typeof languages.ja;

export function getLanguageText(language: Language, key: string): string {
  const langObj = languages[language] as Record<string, string>;
  const fallbackObj = languages.ja as Record<string, string>;
  return langObj[key] || fallbackObj[key] || key;
} 