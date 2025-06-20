import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// データベースファイルのパス
const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const STEPS_FILE = path.join(DATA_DIR, 'steps.json');

// 型定義
export interface ChatSession {
  id: string;
  title: string;
  initial_message: string;
  status: 'in-progress' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
  browser_session_id?: string;
  final_result?: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: any;
}

export interface ChatStep {
  id: string;
  session_id: string;
  step_number: number;
  tool: string;
  instruction: string;
  reasoning: string;
  text: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  created_at: string;
  completed_at?: string;
  error_message?: string;
  result?: any;
}

class ChatDatabase {
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initialized) return;
    
    try {
      // データディレクトリを作成
      await fs.mkdir(DATA_DIR, { recursive: true });
      
      // データファイルが存在しない場合は作成
      await this.ensureFileExists(SESSIONS_FILE, []);
      await this.ensureFileExists(MESSAGES_FILE, []);
      await this.ensureFileExists(STEPS_FILE, []);
      
      this.initialized = true;
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async ensureFileExists(filePath: string, defaultData: any) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
    }
  }

  private async readJsonFile<T>(filePath: string): Promise<T[]> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeJsonFile<T>(filePath: string, data: T[]) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // === セッション管理 ===
  
  async createSession(title: string, initialMessage: string, browserSessionId?: string): Promise<ChatSession> {
    await this.init();
    
    const session: ChatSession = {
      id: uuidv4(),
      title,
      initial_message: initialMessage,
      status: 'in-progress',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      browser_session_id: browserSessionId
    };
    
    const sessions = await this.readJsonFile<ChatSession>(SESSIONS_FILE);
    sessions.push(session);
    await this.writeJsonFile(SESSIONS_FILE, sessions);
    
    return session;
  }

  async getSession(id: string): Promise<ChatSession | null> {
    await this.init();
    
    const sessions = await this.readJsonFile<ChatSession>(SESSIONS_FILE);
    return sessions.find(s => s.id === id) || null;
  }

  async getAllSessions(): Promise<ChatSession[]> {
    await this.init();
    
    const sessions = await this.readJsonFile<ChatSession>(SESSIONS_FILE);
    return sessions.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async updateSessionStatus(id: string, status: ChatSession['status'], finalResult?: string): Promise<void> {
    await this.init();
    
    const sessions = await this.readJsonFile<ChatSession>(SESSIONS_FILE);
    const sessionIndex = sessions.findIndex(s => s.id === id);
    
    if (sessionIndex !== -1) {
      sessions[sessionIndex].status = status;
      sessions[sessionIndex].updated_at = new Date().toISOString();
      if (finalResult) {
        sessions[sessionIndex].final_result = finalResult;
      }
      await this.writeJsonFile(SESSIONS_FILE, sessions);
    }
  }

  async deleteSession(id: string): Promise<boolean> {
    await this.init();
    
    try {
      // セッションを削除
      const sessions = await this.readJsonFile<ChatSession>(SESSIONS_FILE);
      const filteredSessions = sessions.filter(s => s.id !== id);
      await this.writeJsonFile(SESSIONS_FILE, filteredSessions);
      
      // 関連メッセージを削除
      const messages = await this.readJsonFile<ChatMessage>(MESSAGES_FILE);
      const filteredMessages = messages.filter(m => m.session_id !== id);
      await this.writeJsonFile(MESSAGES_FILE, filteredMessages);
      
      // 関連ステップを削除
      const steps = await this.readJsonFile<ChatStep>(STEPS_FILE);
      const filteredSteps = steps.filter(s => s.session_id !== id);
      await this.writeJsonFile(STEPS_FILE, filteredSteps);
      
      return true;
    } catch {
      return false;
    }
  }

  // === メッセージ管理 ===
  
  async addMessage(sessionId: string, type: ChatMessage['type'], content: string, metadata?: any): Promise<ChatMessage> {
    await this.init();
    
    const message: ChatMessage = {
      id: uuidv4(),
      session_id: sessionId,
      type,
      content,
      created_at: new Date().toISOString(),
      metadata
    };
    
    const messages = await this.readJsonFile<ChatMessage>(MESSAGES_FILE);
    messages.push(message);
    await this.writeJsonFile(MESSAGES_FILE, messages);
    
    return message;
  }

  async getMessage(id: string): Promise<ChatMessage | null> {
    await this.init();
    
    const messages = await this.readJsonFile<ChatMessage>(MESSAGES_FILE);
    return messages.find(m => m.id === id) || null;
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    await this.init();
    
    const messages = await this.readJsonFile<ChatMessage>(MESSAGES_FILE);
    return messages
      .filter(m => m.session_id === sessionId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  // === ステップ管理 ===
  
  async addStep(
    sessionId: string, 
    stepNumber: number, 
    tool: string, 
    instruction: string, 
    reasoning: string, 
    text: string
  ): Promise<ChatStep> {
    await this.init();
    
    const step: ChatStep = {
      id: uuidv4(),
      session_id: sessionId,
      step_number: stepNumber,
      tool,
      instruction,
      reasoning,
      text,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    const steps = await this.readJsonFile<ChatStep>(STEPS_FILE);
    steps.push(step);
    await this.writeJsonFile(STEPS_FILE, steps);
    
    return step;
  }

  async getStep(id: string): Promise<ChatStep | null> {
    await this.init();
    
    const steps = await this.readJsonFile<ChatStep>(STEPS_FILE);
    return steps.find(s => s.id === id) || null;
  }

  async getSessionSteps(sessionId: string): Promise<ChatStep[]> {
    await this.init();
    
    const steps = await this.readJsonFile<ChatStep>(STEPS_FILE);
    return steps
      .filter(s => s.session_id === sessionId)
      .sort((a, b) => a.step_number - b.step_number);
  }

  async updateStepStatus(
    id: string, 
    status: ChatStep['status'], 
    errorMessage?: string, 
    result?: any
  ): Promise<void> {
    await this.init();
    
    const steps = await this.readJsonFile<ChatStep>(STEPS_FILE);
    const stepIndex = steps.findIndex(s => s.id === id);
    
    if (stepIndex !== -1) {
      steps[stepIndex].status = status;
      steps[stepIndex].error_message = errorMessage;
      steps[stepIndex].result = result;
      
      if (status === 'completed' || status === 'error') {
        steps[stepIndex].completed_at = new Date().toISOString();
      }
      
      await this.writeJsonFile(STEPS_FILE, steps);
    }
  }

  // === 複合操作 ===
  
  async getSessionWithDetails(sessionId: string) {
    await this.init();
    
    const session = await this.getSession(sessionId);
    if (!session) return null;

    const messages = await this.getSessionMessages(sessionId);
    const steps = await this.getSessionSteps(sessionId);

    return {
      session,
      messages,
      steps
    };
  }

  // === ユーティリティ ===
  
  async cleanup(): Promise<void> {
    await this.init();
    
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoffDate = thirtyDaysAgo.toISOString();
      
      // 古いセッションを取得
      const sessions = await this.readJsonFile<ChatSession>(SESSIONS_FILE);
      const oldSessionIds = sessions
        .filter(s => s.created_at < cutoffDate)
        .map(s => s.id);
      
      if (oldSessionIds.length === 0) return;
      
      // 古いセッションを削除
      const filteredSessions = sessions.filter(s => s.created_at >= cutoffDate);
      await this.writeJsonFile(SESSIONS_FILE, filteredSessions);
      
      // 関連メッセージを削除
      const messages = await this.readJsonFile<ChatMessage>(MESSAGES_FILE);
      const filteredMessages = messages.filter(m => !oldSessionIds.includes(m.session_id));
      await this.writeJsonFile(MESSAGES_FILE, filteredMessages);
      
      // 関連ステップを削除
      const steps = await this.readJsonFile<ChatStep>(STEPS_FILE);
      const filteredSteps = steps.filter(s => !oldSessionIds.includes(s.session_id));
      await this.writeJsonFile(STEPS_FILE, filteredSteps);
      
      console.log(`Cleaned up ${oldSessionIds.length} old sessions`);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  // トランザクション実行（シンプル版）
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.init();
    return await fn();
  }
}

// シングルトンインスタンス
let dbInstance: ChatDatabase | null = null;

export function getDatabase(): ChatDatabase {
  if (!dbInstance) {
    dbInstance = new ChatDatabase();
  }
  return dbInstance;
}

export default ChatDatabase; 