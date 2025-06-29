import { useState, useEffect } from 'react';
import { ChatSession, Message } from '../types';

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load sessions from localStorage
    try {
      const saved = localStorage.getItem('chat-sessions');
      if (saved) {
        const parsedSessions = JSON.parse(saved).map((session: any) => ({
          ...session,
          createdAt: new Date(session.createdAt),
          updatedAt: new Date(session.updatedAt),
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
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

  const createSession = (title: string, model: string): ChatSession => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title,
      messages: [],
      model,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newSessions = [newSession, ...sessions];
    setSessions(newSessions);
    saveSessions(newSessions);
    setCurrentSessionId(newSession.id);
    
    return newSession;
  };

  const updateSession = (sessionId: string, updates: Partial<ChatSession>) => {
    const newSessions = sessions.map(session =>
      session.id === sessionId
        ? { ...session, ...updates, updatedAt: new Date() }
        : session
    );
    setSessions(newSessions);
    saveSessions(newSessions);
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
    updateSession(sessionId, {
      messages: [...(sessions.find(s => s.id === sessionId)?.messages || []), message],
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