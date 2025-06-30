import { NextResponse } from "next/server";
import { availableTools, getToolsByCategory, getToolCategories } from "../../lib/agent-tools";

interface ParameterField {
  required: boolean;
  message: string;
  type: string;
}

interface ParameterInfo {
  fields?: Record<string, ParameterField>;
  error?: string;
}

export async function GET() {
  try {
    const toolsByCategory = getToolsByCategory();
    const categories = getToolCategories();
    
    const toolsInfo = availableTools.map(tool => {
      // Extract schema metadata safely
      let parameters: ParameterInfo = {};
      try {
        // Get the schema description by parsing with an empty object and checking the error
        const parseResult = tool.parameters.safeParse({});
        if (!parseResult.success) {
          // Extract field information from validation errors
          const fields: Record<string, ParameterField> = {};
          parseResult.error.issues.forEach(issue => {
            if (issue.path.length > 0) {
              const fieldName = issue.path[0];
              if (typeof fieldName === 'string') {
                fields[fieldName] = {
                  required: issue.code === 'invalid_type',
                  message: issue.message,
                  type: 'unknown'
                };
              }
            }
          });
          parameters = { fields };
        }
      } catch (error) {
        console.warn(`Failed to extract parameters for tool ${tool.name}:`, error);
        parameters = { error: 'Failed to extract parameters' };
      }

      return {
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters,
      };
    });

    return NextResponse.json({
      success: true,
      tools: toolsInfo,
      toolsByCategory,
      categories,
      totalCount: availableTools.length,
    });
  } catch (error) {
    console.error("Error fetching tools:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch tools",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}