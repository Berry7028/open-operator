// Session storage for API keys (in production, use secure session storage)
const sessionApiKeys: Record<string, string> = {};

// Helper function to get session API key
export function getSessionApiKey(keyName: string): string | undefined {
  return sessionApiKeys[keyName] || process.env[keyName];
}

// Helper function to set session API key
export function setSessionApiKey(keyName: string, value: string): void {
  sessionApiKeys[keyName] = value;
}

// Helper function to get all session keys
export function getSessionKeys(): string[] {
  return Object.keys(sessionApiKeys);
}

// Helper function to clear session API keys
export function clearSessionKeys(): void {
  Object.keys(sessionApiKeys).forEach(key => {
    delete sessionApiKeys[key];
  });
} 