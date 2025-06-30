"use client";

import { motion } from "framer-motion";
import { BrowserStep } from "@/app/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Wrench, Globe, CheckCircle, XCircle, Expand, Minimize } from "lucide-react";
import { useState } from "react";

interface AgentStepsProps {
  steps: BrowserStep[];
}

export function AgentSteps({ steps }: AgentStepsProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  if (steps.length === 0) return null;

  const toggleStep = (stepNumber: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepNumber)) {
      newExpanded.delete(stepNumber);
    } else {
      newExpanded.add(stepNumber);
    }
    setExpandedSteps(newExpanded);
  };

  const expandAll = () => {
    const allSteps = new Set(steps.map((_, index) => steps[index].stepNumber || index));
    setExpandedSteps(allSteps);
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  const getStepIcon = (tool: string) => {
    switch (tool) {
      case "CALL_TOOL":
        return <Wrench className="h-4 w-4" />;
      case "GOTO":
      case "ACT":
      case "EXTRACT":
      case "OBSERVE":
        return <Globe className="h-4 w-4" />;
      default:
        return <Globe className="h-4 w-4" />;
    }
  };

  const getToolResultStatus = (toolResult: unknown) => {
    if (
      toolResult &&
      typeof toolResult === 'object' &&
      'success' in toolResult
    ) {
      const result = toolResult as { success: boolean };
      if (result.success === false) {
        return <XCircle className="h-4 w-4 text-destructive" />;
      }
      if (result.success === true) {
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      }
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="bg-card border-border max-h-[60vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="font-ppneue text-card-foreground">
              Agent Execution Steps ({steps.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                disabled={expandedSteps.size === steps.length}
                className="h-8 px-2 text-xs"
              >
                <Expand className="h-3 w-3 mr-1" />
                すべて展開
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                disabled={expandedSteps.size === 0}
                className="h-8 px-2 text-xs"
              >
                <Minimize className="h-3 w-3 mr-1" />
                すべて折りたたみ
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 overflow-y-auto flex-1 min-h-0">
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.stepNumber || index);
            const hasToolResult = Boolean(step.tool === "CALL_TOOL" && step.toolResult);
            
            return (
              <Card key={index} className="bg-muted/50 border-border">
                <Collapsible>
                  <CollapsibleTrigger
                    onClick={() => toggleStep(step.stepNumber || index)}
                    className="w-full"
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground font-ppsupply">
                            Step {step.stepNumber}
                          </span>
                          {getStepIcon(step.tool)}
                          {getToolResultStatus(step.toolResult)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={step.tool === "CALL_TOOL" ? "default" : "secondary"} 
                            className="font-ppsupply"
                          >
                            {step.tool === "CALL_TOOL" ? "TOOL" : step.tool}
                          </Badge>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <p className="font-medium font-ppsupply text-card-foreground text-left">
                        {step.text}
                      </p>
                    </CardContent>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0 px-3 pb-3">
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-semibold text-muted-foreground">Reasoning: </span>
                          <span className="text-muted-foreground font-ppsupply">
                            {step.reasoning}
                          </span>
                        </div>
                        
                        <div>
                          <span className="font-semibold text-muted-foreground">Instruction: </span>
                          <span className="text-muted-foreground font-ppsupply font-mono text-xs">
                            {step.instruction}
                          </span>
                        </div>

                        {hasToolResult ? (
                          <div className="space-y-3">
                            {/* AI回答を優先的に表示 */}
                            {step.toolResult && 
                             typeof step.toolResult === 'object' && 
                             'aiResponse' in step.toolResult && 
                             step.toolResult.aiResponse ? (
                              <div>
                                <span className="font-semibold text-muted-foreground">AI回答: </span>
                                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                                  <p className="text-sm text-foreground font-ppsupply whitespace-pre-wrap">
                                    {step.toolResult.aiResponse as string}
                                  </p>
                                </div>
                              </div>
                            ) : null}
                            
                            {/* 詳細な技術的結果 */}
                            <details className="group">
                              <summary className="cursor-pointer">
                                <span className="font-semibold text-muted-foreground">
                                  詳細な実行結果 
                                  <span className="ml-1 text-xs group-open:hidden">(クリックで展開)</span>
                                </span>
                              </summary>
                              <div className="mt-2 p-3 bg-background border border-border rounded-md max-h-48 overflow-y-auto">
                                <pre className="text-xs font-mono text-foreground overflow-x-auto">
                                  {JSON.stringify(step.toolResult, null, 2)}
                                </pre>
                              </div>
                            </details>
                          </div>
                        ) : null}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}