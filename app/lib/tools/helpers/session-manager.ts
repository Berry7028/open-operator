import { SessionInfo } from "../types";

// セッション状態管理
const activeSessions = new Map<string, SessionInfo>();

export function isSessionActive(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  return session ? session.isActive : false;
}

export function startSession(sessionId: string): void {
  activeSessions.set(sessionId, {
    sessionId,
    startedAt: new Date(),
    isActive: true
  });
}

export function closeSession(sessionId: string): void {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.isActive = false;
    activeSessions.set(sessionId, session);
  }
}

export function getSessionStatus(sessionId: string): SessionInfo | null {
  return activeSessions.get(sessionId) || null;
} 