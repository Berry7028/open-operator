import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'step';
  content: string;
  timestamp: string;
  step?: {
    text: string;
    reasoning: string;
    tool: string;
    instruction: string;
    stepNumber?: number;
  };
  isSearchResult?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  status: 'completed' | 'in-progress' | 'error';
  steps?: any[];
  messages?: ChatMessage[];
  aiResponse?: string;
  finalResult?: any;
}

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

export async function saveChatSession(session: Omit<ChatSession, 'id' | 'timestamp'>) {
  await ensureDataDir();
  
  const chatSession: ChatSession = {
    ...session,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
  };
  
  const filePath = path.join(DATA_DIR, `${chatSession.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(chatSession, null, 2));
  
  return chatSession;
}

export async function updateChatSession(id: string, updates: Partial<ChatSession>) {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const session = JSON.parse(data);
    const updatedSession = { ...session, ...updates, timestamp: new Date().toISOString() };
    await fs.writeFile(filePath, JSON.stringify(updatedSession, null, 2));
    return updatedSession;
  } catch (error) {
    console.error('Error updating chat session:', error);
    throw error;
  }
}

export async function getChatSession(id: string): Promise<ChatSession | null> {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  await ensureDataDir();
  
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const sessions = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(DATA_DIR, file);
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
      })
    );
    
    // Sort by timestamp (newest first)
    return sessions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function deleteChatSession(id: string) {
  const filePath = path.join(DATA_DIR, `${id}.json`);
  
  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
} 