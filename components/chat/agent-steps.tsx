"use client";

import { motion } from "framer-motion";
import { BrowserStep } from "@/app/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AgentStepsProps {
  steps: BrowserStep[];
}

export function AgentSteps({ steps }: AgentStepsProps) {
  if (steps.length === 0) return null;

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
          {steps.map((step, index) => (
            <Card key={index} className="bg-muted/50 border-border">
              <CardContent className="p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground font-ppsupply">
                    Step {step.stepNumber}
                  </span>
                  <Badge variant="secondary" className="font-ppsupply bg-secondary text-secondary-foreground">
                    {step.tool}
                  </Badge>
                </div>
                <p className="font-medium font-ppsupply text-card-foreground">{step.text}</p>
                <p className="text-sm text-muted-foreground font-ppsupply mt-1">
                  <span className="font-semibold">Reasoning: </span>
                  {step.reasoning}
                </p>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}