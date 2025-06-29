"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import ChatSidebar from "./Sidebar/ChatSidebar";
import WelcomeScreen from "./Chat/WelcomeScreen";
import ChatInterface from "./Chat/ChatInterface";
import SettingsModal from "./Settings/SettingsModal";
import { useChatSessions } from "../hooks/useChatSessions";
import { useSettings } from "../hooks/useSettings";
import { Message } from "../types";
import { LLM_PROVIDERS } from "../constants/llm-providers";

export default function ClientApp() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    createSession,
    updateSession,
    deleteSession,
    addMessage,
    getCurrentSession,
    isLoading: sessionsLoading,
  } = useChatSessions();

  const {
    settings,
    updateSettings,
    exportSettings,
    importSettings,
    isLoading: settingsLoading,
  } = useSettings();

  const [selectedModel, setSelectedModel] = useState(settings.defaultModel);

  useEffect(() => {
    setSelectedModel(settings.defaultModel);
  }, [settings.defaultModel]);

  const enabledProviders = Object.keys(settings.providers).filter(
    providerId => settings.providers[providerId]?.enabled && settings.providers[providerId]?.apiKey
  );

  const handleNewChat = () => {
    setCurrentSessionId(null);
  };

  const handleStartChat = (message: string, model: string) => {
    const session = createSession(
      message.length > 50 ? message.substring(0, 50) + "..." : message,
      model
    );

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      role: "user",
      timestamp: new Date(),
    };

    addMessage(session.id, userMessage);
  };

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const currentSession = getCurrentSession();

  if (sessionsLoading || settingsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-900">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={handleSessionSelect}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <ChatInterface
            session={currentSession}
            onUpdateSession={updateSession}
            onAddMessage={addMessage}
          />
        ) : (
          <WelcomeScreen
            onStartChat={handleStartChat}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            enabledProviders={enabledProviders}
          />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onExportSettings={exportSettings}
        onImportSettings={importSettings}
      />
    </div>
  );
}