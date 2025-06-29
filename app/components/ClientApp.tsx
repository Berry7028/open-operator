"use client";

import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import ChatSidebar from "./Sidebar/ChatSidebar";
import WelcomeScreen from "./Chat/WelcomeScreen";
import ChatInterface from "./Chat/ChatInterface";
import SettingsModal from "./Settings/SettingsModal";
import { useChatSessions } from "../hooks/useChatSessions";
import { useSettings } from "../hooks/useSettings";
import { useModels } from "../hooks/useModels";
import { Message } from "../types";

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

  const { models, isLoading: modelsLoading } = useModels();

  const [selectedModel, setSelectedModel] = useState(settings.defaultModel);

  useEffect(() => {
    // Set default model when models are loaded
    if (models.length > 0 && !selectedModel) {
      const defaultModel = models.find(m => m.id === settings.defaultModel) || models[0];
      setSelectedModel(defaultModel.id);
    }
  }, [models, selectedModel, settings.defaultModel]);

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

  if (sessionsLoading || settingsLoading || modelsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
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