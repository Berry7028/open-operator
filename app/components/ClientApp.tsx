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
import { generateMessageId } from "../lib/utils";

export default function ClientApp() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasSkippedInitialSettings, setHasSkippedInitialSettings] = useState(false);

  // Load skipped settings state on client side only
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const skipped = localStorage.getItem('hasSkippedInitialSettings') === 'true';
      setHasSkippedInitialSettings(skipped);
    }
  }, []);
  
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
    getEnabledProviders,
    isLoading: settingsLoading,
  } = useSettings();

  const { models, isLoading: modelsLoading, error: modelsError, refetchModels } = useModels();

  const [selectedModel, setSelectedModel] = useState(settings.defaultModel);

  useEffect(() => {
    // Set default model when models are loaded
    if (models.length > 0 && !selectedModel) {
      const defaultModel = models.find(m => m.id === settings.defaultModel) || models[0];
      setSelectedModel(defaultModel.id);
    }
  }, [models, selectedModel, settings.defaultModel]);

  // Refetch models when providers are enabled (without causing infinite loop)
  useEffect(() => {
    const enabledProviders = getEnabledProviders();
    if (enabledProviders.length > 0 && models.length === 0 && !modelsLoading) {
      refetchModels();
    }
  }, [getEnabledProviders().length, models.length, modelsLoading, refetchModels]);

  // Reset skip state when providers are configured
  useEffect(() => {
    const enabledProviders = getEnabledProviders();
    if (enabledProviders.length > 0 && hasSkippedInitialSettings) {
      setHasSkippedInitialSettings(false);
      localStorage.removeItem('hasSkippedInitialSettings');
    }
  }, [getEnabledProviders().length, hasSkippedInitialSettings]);

  const handleNewChat = () => {
    setCurrentSessionId(null);
  };

  const handleStartChat = (message: string, model: string, selectedTools: string[] = []) => {
    console.log("Starting chat with:", { message, model, selectedTools });
    
    const userMessage: Message = {
      id: generateMessageId(),
      content: message,
      role: "user",
      timestamp: new Date(),
    };

    const session = createSession(
      message.length > 50 ? message.substring(0, 50) + "..." : message,
      model,
      selectedTools,
      userMessage // Pass the initial message
    );

    console.log("Created session with initial message:", session.id);
  };

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId);
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  const currentSession = getCurrentSession();
  
  // Debug: Log current session state
  useEffect(() => {
    console.log("Current session changed:", currentSession ? currentSession.id : "null");
    console.log("Current session object:", currentSession);
  }, [currentSession]);

  if (sessionsLoading || settingsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
      </div>
    );
  }

  // Show settings modal if no providers are configured and user hasn't skipped
  const enabledProviders = getEnabledProviders();
  const shouldShowSettings = enabledProviders.length === 0 && !hasSkippedInitialSettings;

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
        {(() => {
          console.log("Rendering main content. Current session:", currentSession ? currentSession.id : "null");
          return currentSession ? (
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
          );
        })()}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen || shouldShowSettings}
        onClose={() => {
          setIsSettingsOpen(false);
          if (shouldShowSettings) {
            setHasSkippedInitialSettings(true);
            localStorage.setItem('hasSkippedInitialSettings', 'true');
          }
        }}
        settings={settings}
        onUpdateSettings={updateSettings}
        onExportSettings={exportSettings}
        onImportSettings={importSettings}
        showSkipOption={shouldShowSettings}
      />
    </div>
  );
}