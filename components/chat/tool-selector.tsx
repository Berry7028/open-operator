"use client";

import { useState, useEffect } from "react";
import { useTools } from "@/app/hooks/useTools";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Settings, Wrench, Loader2, AlertCircle } from "lucide-react";

interface ToolSelectorProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
}

export function ToolSelector({ selectedTools, onToolsChange }: ToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    tools,
    categories,
    toolsByCategory,
    isLoading,
    error,
    toggleTool,
    toggleCategory,
    toggleAll,
    setExternalSelectedTools,
    getSelectedToolsCount,
    getTotalToolsCount,
    isAllSelected,
    isCategorySelected,
  } = useTools(selectedTools);

  // Sync external changes to internal state
  useEffect(() => {
    setExternalSelectedTools(selectedTools);
  }, [selectedTools, setExternalSelectedTools]);

  const handleToggleTool = (toolName: string) => {
    const newSelectedTools = selectedTools.includes(toolName)
      ? selectedTools.filter(name => name !== toolName)
      : [...selectedTools, toolName];
    
    toggleTool(toolName);
    onToolsChange(newSelectedTools);
  };

  const handleToggleCategory = (category: string, enabled: boolean) => {
    const categoryTools = toolsByCategory[category] || [];
    const categoryToolNames = categoryTools.map(tool => tool.name);
    
    let newSelectedTools;
    if (enabled) {
      newSelectedTools = [...new Set([...selectedTools, ...categoryToolNames])];
    } else {
      newSelectedTools = selectedTools.filter(name => !categoryToolNames.includes(name));
    }
    
    toggleCategory(category, enabled);
    onToolsChange(newSelectedTools);
  };

  const handleToggleAll = (enabled: boolean) => {
    const newSelectedTools = enabled ? tools.map(tool => tool.name) : [];
    toggleAll(enabled);
    onToolsChange(newSelectedTools);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-md">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground font-ppsupply">
          Loading tools...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-md">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <p className="text-sm text-destructive font-ppsupply">{error}</p>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="font-ppsupply">
          <Wrench className="h-4 w-4 mr-2" />
          Tools ({getSelectedToolsCount()}/{getTotalToolsCount()})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="font-ppneue flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Select Agent Tools
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 min-h-0">
          {/* Master Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-ppneue">All Tools</CardTitle>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={isAllSelected()}
                    onCheckedChange={handleToggleAll}
                  />
                  <Label className="font-ppsupply">
                    {isAllSelected() ? 'Disable All' : 'Enable All'}
                  </Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground font-ppsupply">
                {getSelectedToolsCount()} of {getTotalToolsCount()} tools selected
              </p>
            </CardContent>
          </Card>

          <Separator />

          {/* Tools by Category */}
          <div className="space-y-4">
            {categories.map(category => {
              const categoryTools = toolsByCategory[category] || [];
              const isCategoryFullySelected = isCategorySelected(category);
              
              return (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-ppneue capitalize">
                          {category}
                        </CardTitle>
                        <Badge variant="secondary" className="font-ppsupply">
                          {categoryTools.length}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={isCategoryFullySelected}
                          onCheckedChange={(checked) => handleToggleCategory(category, checked)}
                        />
                        <Label className="font-ppsupply text-sm">
                          {isCategoryFullySelected ? 'Disable Category' : 'Enable Category'}
                        </Label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {categoryTools.map(tool => (
                        <div
                          key={tool.name}
                          className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium font-ppsupply text-sm">
                                {tool.name.replace(/_/g, ' ')}
                              </h4>
                            </div>
                            <p className="text-xs text-muted-foreground font-ppsupply">
                              {tool.description}
                            </p>
                          </div>
                          <Switch
                            checked={selectedTools.includes(tool.name)}
                            onCheckedChange={() => handleToggleTool(tool.name)}
                            className="ml-3"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="font-ppsupply">
            Cancel
          </Button>
          <Button onClick={() => setIsOpen(false)} className="font-ppsupply">
            Apply Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}