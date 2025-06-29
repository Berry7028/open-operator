"use client";

import { motion } from "framer-motion";
import { BrowserStep } from "@/app/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Wrench, Globe, CheckCircle, XCircle } from "lucide-react";
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

  const getToolResultStatus = (toolResult: any) => {
    if (!toolResult) return null;
    if (toolResult.success === false) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (toolResult.success === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-ppneue text-card-foreground">Agent Execution Steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, index) => {
            const isExpanded = expandedSteps.has(step.stepNumber || index);
            const hasToolResult = step.tool === "CALL_TOOL" && step.toolResult;
            
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

                        {hasToolResult && (
                          <div>
                            <span className="font-semibold text-muted-foreground">Tool Result: </span>
                            <div className="mt-2 p-3 bg-background border border-border rounded-md">
                              <pre className="text-xs font-mono text-foreground overflow-x-auto">
                                {JSON.stringify(step.toolResult, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
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