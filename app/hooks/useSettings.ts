import { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { DEFAULT_MODEL } from '../constants/llm-providers';

const DEFAULT_SETTINGS: AppSettings = {
  providers: {},
  defaultModel: DEFAULT_MODEL,
  theme: 'system',
  autoSave: true,
  defaultTools: [],
  language: 'ja',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load settings from localStorage
    try {
      const saved = localStorage.getItem('app-settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings({ ...DEFAULT_SETTINGS, ...parsedSettings });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    try {
      localStorage.setItem('app-settings', JSON.stringify(updated));
      
      // Also update environment variables for the session
      if (newSettings.providers) {
        updateSessionEnvironment(updated.providers);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const updateSessionEnvironment = async (providers: AppSettings['providers']) => {
    try {
      // Send API keys to backend for session use
      await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ providers }),
      });
    } catch (error) {
      console.error('Failed to update session environment:', error);
    }
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'open-operator-settings.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target?.result as string);
          updateSettings(imported);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const getEnabledProviders = () => {
    return Object.keys(settings.providers).filter(
      providerId => settings.providers[providerId]?.enabled && settings.providers[providerId]?.apiKey
    );
  };

  return {
    settings,
    updateSettings,
    exportSettings,
    importSettings,
    getEnabledProviders,
    isLoading,
  };
}