import { useState, useEffect } from 'react';
import { ChatSession, Message } from '../types';
import { generateSessionId } from '../lib/utils';

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load sessions from localStorage
    try {
      const saved = localStorage.getItem('chat-sessions');
      if (saved) {
        const parsedSessions = JSON.parse(saved).map((session: Record<string, unknown>) => ({
          ...session,
          createdAt: new Date(session.createdAt as string),
          updatedAt: new Date(session.updatedAt as string),
          selectedTools: (session.selectedTools as string[]) || [],
          messages: (session.messages as Record<string, unknown>[]).map((msg: Record<string, unknown>) => ({
            ...msg,
            timestamp: new Date(msg.timestamp as string),
          })),
        }));
        setSessions(parsedSessions);
      }
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSessions = (newSessions: ChatSession[]) => {
    try {
      localStorage.setItem('chat-sessions', JSON.stringify(newSessions));
    } catch (error) {
      console.error('Failed to save chat sessions:', error);
    }
  };

  const createSession = (title: string, model: string, selectedTools: string[] = [], initialMessage?: Message): ChatSession => {
    const newSession: ChatSession = {
      id: generateSessionId(),
      title,
      messages: initialMessage ? [initialMessage] : [],
      model,
      selectedTools,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log("Creating new session:", newSession.id, "with", initialMessage ? "initial message" : "no messages");
    
    const newSessions = [newSession, ...sessions];
    setSessions(newSessions);
    saveSessions(newSessions);
    setCurrentSessionId(newSession.id);
    
    console.log("Set current session ID to:", newSession.id);
    
    return newSession;
  };

  const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
    console.log("Updating session:", sessionId, "with:", Object.keys(updates));
    const newSessions = sessions.map(session =>
      session.id === sessionId
        ? { ...session, ...updates, updatedAt: new Date() }
        : session
    );
    setSessions(newSessions);
    saveSessions(newSessions);
    console.log("Session updated successfully");
  };

  const deleteSession = (sessionId: string) => {
    const newSessions = sessions.filter(session => session.id !== sessionId);
    setSessions(newSessions);
    saveSessions(newSessions);
    
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
    }
  };

  const addMessage = (sessionId: string, message: Message) => {
    console.log("Adding message to session:", sessionId, message.content);
    console.log("Available sessions:", sessions.map(s => s.id));
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      console.error("Session not found:", sessionId);
      console.error("Available sessions:", sessions);
      console.error("Current session ID:", currentSessionId);
      return;
    }
    
    updateSession(sessionId, {
      messages: [...session.messages, message],
    });
  };

  const getCurrentSession = () => {
    return sessions.find(session => session.id === currentSessionId) || null;
  };

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createSession,
    updateSession,
    deleteSession,
    addMessage,
    getCurrentSession,
    isLoading,
  };
}