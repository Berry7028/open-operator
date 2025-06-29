"use client";

import { useState, useRef } from "react";
import { AppSettings } from "../../types";
import { LLM_PROVIDERS } from "../../constants/llm-providers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-ppneue">Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="providers" className="h-[600px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="providers" className="font-ppsupply">LLM Providers</TabsTrigger>
            <TabsTrigger value="general" className="font-ppsupply">General</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="mt-4 h-full overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-ppneue mb-2">LLM Provider Configuration</h3>
                <p className="text-sm text-muted-foreground font-ppsupply">
                  Configure your API keys and settings for different LLM providers.
                </p>
              </div>

              {LLM_PROVIDERS.map((provider) => (
                <Card key={provider.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-ppneue">{provider.name}</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={settings.providers[provider.id]?.enabled || false}
                          onCheckedChange={(checked) =>
                            updateProviderSetting(provider.id, 'enabled', checked)
                          }
                        />
                        <Label className="font-ppsupply">Enabled</Label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="font-ppsupply">{provider.apiKeyLabel}</Label>
                      <Input
                        type="password"
                        value={settings.providers[provider.id]?.apiKey || ''}
                        onChange={(e) =>
                          updateProviderSetting(provider.id, 'apiKey', e.target.value)
                        }
                        placeholder="Enter your API key"
                        className="font-ppsupply"
                      />
                    </div>

                    {provider.baseUrl && (
                      <div>
                        <Label className="font-ppsupply">Base URL (Optional)</Label>
                        <Input
                          type="url"
                          value={settings.providers[provider.id]?.baseUrl || ''}
                          onChange={(e) =>
                            updateProviderSetting(provider.id, 'baseUrl', e.target.value)
                          }
                          placeholder="https://api.example.com"
                          className="font-ppsupply"
                        />
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground font-ppsupply">
                      Available models: {provider.models.map(m => m.name).join(', ')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="general" className="mt-4 h-full overflow-y-auto">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-ppneue mb-2">General Settings</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="font-ppsupply">Default Model</Label>
                  <Select
                    value={settings.defaultModel}
                    onValueChange={(value) => onUpdateSettings({ defaultModel: value })}
                  >
                    <SelectTrigger className="font-ppsupply">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LLM_PROVIDERS.flatMap(provider =>
                        provider.models.map(model => (
                          <SelectItem key={model.id} value={model.id} className="font-ppsupply">
                            {provider.name} - {model.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="font-ppsupply">Theme</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(value: 'light' | 'dark' | 'system') => 
                      onUpdateSettings({ theme: value })
                    }
                  >
                    <SelectTrigger className="font-ppsupply">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system" className="font-ppsupply">System</SelectItem>
                      <SelectItem value="light" className="font-ppsupply">Light</SelectItem>
                      <SelectItem value="dark" className="font-ppsupply">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoSave"
                    checked={settings.autoSave}
                    onCheckedChange={(checked) => onUpdateSettings({ autoSave: checked })}
                  />
                  <Label htmlFor="autoSave" className="font-ppsupply">
                    Auto-save chat sessions
                  </Label>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="font-ppneue">Import/Export Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Button onClick={onExportSettings} className="font-ppsupply">
                      Export Settings
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-ppsupply"
                    >
                      Import Settings
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </div>
                  {importError && (
                    <p className="text-destructive text-sm font-ppsupply">{importError}</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}