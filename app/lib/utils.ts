export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return generateId('session');
}

export function generateMessageId(): string {
  return generateId('msg');
}

// SSR-safe function to check if we're on the client side
export function isClient(): boolean {
  return typeof window !== 'undefined';
} 