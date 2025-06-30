import { useState, useEffect } from 'react';
import { ToolSelection } from '../types';

interface Tool {
  name: string;
  description: string;
  category: string;
  parameters: Record<string, unknown>;
}

interface ToolsResponse {
  success: boolean;
  tools: Tool[];
  toolsByCategory: Record<string, Tool[]>;
  categories: string[];
  totalCount: number;
}

export function useTools() {
  const [tools, setTools] = useState<ToolSelection[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [toolsByCategory, setToolsByCategory] = useState<Record<string, ToolSelection[]>>({});
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/tools');
        const data: ToolsResponse = await response.json();
        
        if (data.success) {
          const toolSelections: ToolSelection[] = data.tools.map(tool => ({
            id: tool.name,
            name: tool.name,
            category: tool.category,
            description: tool.description,
            enabled: false,
          }));
          
          setTools(toolSelections);
          setCategories(data.categories);
          
          // Group tools by category
          const grouped: Record<string, ToolSelection[]> = {};
          toolSelections.forEach(tool => {
            if (!grouped[tool.category]) {
              grouped[tool.category] = [];
            }
            grouped[tool.category].push(tool);
          });
          setToolsByCategory(grouped);
          
          setError(null);
        } else {
          setError('Failed to fetch tools');
        }
      } catch (err) {
        setError('Network error while fetching tools');
        console.error('Error fetching tools:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, []);

  const toggleTool = (toolName: string) => {
    setSelectedTools(prev => 
      prev.includes(toolName)
        ? prev.filter(name => name !== toolName)
        : [...prev, toolName]
    );
    
    setTools(prev => 
      prev.map(tool => 
        tool.name === toolName 
          ? { ...tool, enabled: !tool.enabled }
          : tool
      )
    );
  };

  const toggleCategory = (category: string, enabled: boolean) => {
    const categoryTools = toolsByCategory[category] || [];
    const categoryToolNames = categoryTools.map(tool => tool.name);
    
    if (enabled) {
      setSelectedTools(prev => [...new Set([...prev, ...categoryToolNames])]);
    } else {
      setSelectedTools(prev => prev.filter(name => !categoryToolNames.includes(name)));
    }
    
    setTools(prev => 
      prev.map(tool => 
        categoryToolNames.includes(tool.name)
          ? { ...tool, enabled }
          : tool
      )
    );
  };

  const toggleAll = (enabled: boolean) => {
    if (enabled) {
      setSelectedTools(tools.map(tool => tool.name));
    } else {
      setSelectedTools([]);
    }
    
    setTools(prev => 
      prev.map(tool => ({ ...tool, enabled }))
    );
  };

  const getSelectedToolsCount = () => selectedTools.length;
  const getTotalToolsCount = () => tools.length;
  const isAllSelected = () => selectedTools.length === tools.length;
  const isCategorySelected = (category: string) => {
    const categoryTools = toolsByCategory[category] || [];
    return categoryTools.every(tool => selectedTools.includes(tool.name));
  };

  return {
    tools,
    categories,
    toolsByCategory,
    selectedTools,
    isLoading,
    error,
    toggleTool,
    toggleCategory,
    toggleAll,
    getSelectedToolsCount,
    getTotalToolsCount,
    isAllSelected,
    isCategorySelected,
  };
}