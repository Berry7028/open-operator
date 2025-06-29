"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { AppSettings } from "../../types";
import { LLM_PROVIDERS } from "../../constants/llm-providers";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onExportSettings: () => void;
  onImportSettings: (file: File) => Promise<void>;
}

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportSettings,
  onImportSettings,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'general'>('providers');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await onImportSettings(file);
      setImportError(null);
    } catch (error) {
      setImportError('Failed to import settings. Please check the file format.');
    }
  };

  const updateProviderSetting = (providerId: string, key: string, value: any) => {
    const newProviders = {
      ...settings.providers,
      [providerId]: {
        ...settings.providers[providerId],
        [key]: value,
      },
    };
    onUpdateSettings({ providers: newProviders });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-ppneue text-gray-900">Settings</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex h-[600px]">
              {/* Sidebar */}
              <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
                <nav className="space-y-2">
                  <button
                    onClick={() => setActiveTab('providers')}
                    className={`w-full text-left px-3 py-2 rounded-lg font-ppsupply transition-colors ${
                      activeTab === 'providers'
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    LLM Providers
                  </button>
                  <button
                    onClick={() => setActiveTab('general')}
                    className={`w-full text-left px-3 py-2 rounded-lg font-ppsupply transition-colors ${
                      activeTab === 'general'
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    General
                  </button>
                </nav>
              </div>

              {/* Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {activeTab === 'providers' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-ppneue text-gray-900 mb-4">LLM Provider Configuration</h3>
                      <p className="text-sm text-gray-600 mb-6 font-ppsupply">
                        Configure your API keys and settings for different LLM providers.
                      </p>
                    </div>

                    {LLM_PROVIDERS.map((provider) => (
                      <div key={provider.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-ppneue text-gray-900">{provider.name}</h4>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={settings.providers[provider.id]?.enabled || false}
                              onChange={(e) =>
                                updateProviderSetting(provider.id, 'enabled', e.target.checked)
                              }
                              className="mr-2"
                            />
                            <span className="text-sm font-ppsupply text-gray-600">Enabled</span>
                          </label>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1 font-ppsupply">
                              {provider.apiKeyLabel}
                            </label>
                            <input
                              type="password"
                              value={settings.providers[provider.id]?.apiKey || ''}
                              onChange={(e) =>
                                updateProviderSetting(provider.id, 'apiKey', e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-ppsupply"
                              placeholder="Enter your API key"
                            />
                          </div>

                          {provider.baseUrl && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1 font-ppsupply">
                                Base URL (Optional)
                              </label>
                              <input
                                type="url"
                                value={settings.providers[provider.id]?.baseUrl || ''}
                                onChange={(e) =>
                                  updateProviderSetting(provider.id, 'baseUrl', e.target.value)
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-ppsupply"
                                placeholder="https://api.example.com"
                              />
                            </div>
                          )}

                          <div className="text-xs text-gray-500 font-ppsupply">
                            Available models: {provider.models.map(m => m.name).join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-ppneue text-gray-900 mb-4">General Settings</h3>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 font-ppsupply">
                        Default Model
                      </label>
                      <select
                        value={settings.defaultModel}
                        onChange={(e) => onUpdateSettings({ defaultModel: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-ppsupply"
                      >
                        {LLM_PROVIDERS.flatMap(provider =>
                          provider.models.map(model => (
                            <option key={model.id} value={model.id}>
                              {provider.name} - {model.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 font-ppsupply">
                        Theme
                      </label>
                      <select
                        value={settings.theme}
                        onChange={(e) => onUpdateSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-ppsupply"
                      >
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="autoSave"
                        checked={settings.autoSave}
                        onChange={(e) => onUpdateSettings({ autoSave: e.target.checked })}
                        className="mr-2"
                      />
                      <label htmlFor="autoSave" className="text-sm font-ppsupply text-gray-700">
                        Auto-save chat sessions
                      </label>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                      <h4 className="font-ppneue text-gray-900 mb-4">Import/Export Settings</h4>
                      <div className="flex gap-3">
                        <button
                          onClick={onExportSettings}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-ppsupply"
                        >
                          Export Settings
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-ppsupply"
                        >
                          Import Settings
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".json"
                          onChange={handleImport}
                          className="hidden"
                        />
                      </div>
                      {importError && (
                        <p className="text-red-600 text-sm mt-2 font-ppsupply">{importError}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}