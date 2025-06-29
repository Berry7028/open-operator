import { NextResponse } from "next/server";
import { availableTools, getToolsByCategory, getToolCategories } from "../../lib/agent-tools";

export async function GET() {
  try {
    const toolsByCategory = getToolsByCategory();
    const categories = getToolCategories();
    
    const toolsInfo = availableTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters._def,
    }));

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
      { success: false, error: "Failed to fetch tools" },
      { status: 500 }
    );
  }
}