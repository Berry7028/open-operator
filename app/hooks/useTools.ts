import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  error?: string;
  details?: string;
}

export function useTools(initialSelectedTools: string[] = []) {
  const [tools, setTools] = useState<ToolSelection[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [toolsByCategory, setToolsByCategory] = useState<Record<string, ToolSelection[]>>({});
  const [selectedTools, setSelectedTools] = useState<string[]>(initialSelectedTools);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track if this is the initial mount to prevent unnecessary re-fetches
  const isInitialMount = useRef(true);
  const lastExternalUpdate = useRef<string[]>(initialSelectedTools);

  // Create stable reference for the initial selected tools using useMemo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableInitialSelectedTools = useMemo(() => initialSelectedTools, []);

  // Only fetch tools once on mount
  useEffect(() => {
    const fetchTools = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/tools');
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data: ToolsResponse = await response.json();
        
        if (data.success) {
          const toolSelections: ToolSelection[] = data.tools.map(tool => ({
            id: tool.name,
            name: tool.name,
            category: tool.category,
            description: tool.description,
            enabled: stableInitialSelectedTools.includes(tool.name),
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
        } else {
          setError(data.error || 'Failed to fetch tools');
          if (data.details) {
            console.error('Tool fetch error details:', data.details);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Network error while fetching tools';
        setError(errorMessage);
        console.error('Error fetching tools:', err);
      } finally {
        setIsLoading(false);
        isInitialMount.current = false;
      }
    };

    fetchTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  // Sync with external selected tools changes (but not on initial mount or when we're the source of change)
  useEffect(() => {
    if (isInitialMount.current) return;
    
    // Check if this is actually an external change
    const currentExternal = JSON.stringify(initialSelectedTools.sort());
    const lastExternal = JSON.stringify(lastExternalUpdate.current.sort());
    const currentInternal = JSON.stringify(selectedTools.sort());
    
    // Only update if external change and different from current internal state
    if (currentExternal !== lastExternal && currentExternal !== currentInternal) {
      lastExternalUpdate.current = initialSelectedTools;
      setSelectedTools(initialSelectedTools);
      setTools(prev => 
        prev.map(tool => ({
          ...tool,
          enabled: initialSelectedTools.includes(tool.name)
        }))
      );
    }
  }, [initialSelectedTools, selectedTools]);

  const toggleTool = useCallback((toolName: string) => {
    setSelectedTools(prev => {
      const newSelected = prev.includes(toolName)
        ? prev.filter(name => name !== toolName)
        : [...prev, toolName];
      lastExternalUpdate.current = newSelected; // Track our own changes
      return newSelected;
    });
    
    setTools(prev => 
      prev.map(tool => 
        tool.name === toolName 
          ? { ...tool, enabled: !tool.enabled }
          : tool
      )
    );
  }, []);

  const toggleCategory = useCallback((category: string, enabled: boolean) => {
    const categoryTools = toolsByCategory[category] || [];
    const categoryToolNames = categoryTools.map(tool => tool.name);
    
    setSelectedTools(prev => {
      let newSelected;
      if (enabled) {
        newSelected = [...new Set([...prev, ...categoryToolNames])];
      } else {
        newSelected = prev.filter(name => !categoryToolNames.includes(name));
      }
      lastExternalUpdate.current = newSelected; // Track our own changes
      return newSelected;
    });
    
    setTools(prev => 
      prev.map(tool => 
        categoryToolNames.includes(tool.name)
          ? { ...tool, enabled }
          : tool
      )
    );
  }, [toolsByCategory]);

  const toggleAll = useCallback((enabled: boolean) => {
    setSelectedTools(() => {
      const newSelected = enabled ? tools.map(tool => tool.name) : [];
      lastExternalUpdate.current = newSelected; // Track our own changes
      return newSelected;
    });
    
    setTools(prev => 
      prev.map(tool => ({ ...tool, enabled }))
    );
  }, [tools]);

  const setExternalSelectedTools = useCallback((newSelectedTools: string[]) => {
    // Don't update if this is the same as our current state
    if (JSON.stringify(newSelectedTools.sort()) === JSON.stringify(selectedTools.sort())) {
      return;
    }
    
    lastExternalUpdate.current = newSelectedTools;
    setSelectedTools(newSelectedTools);
    setTools(prev => 
      prev.map(tool => ({
        ...tool,
        enabled: newSelectedTools.includes(tool.name)
      }))
    );
  }, [selectedTools]);

  const getSelectedToolsCount = useCallback(() => selectedTools.length, [selectedTools]);
  const getTotalToolsCount = useCallback(() => tools.length, [tools]);
  const isAllSelected = useCallback(() => selectedTools.length === tools.length && tools.length > 0, [selectedTools.length, tools.length]);
  const isCategorySelected = useCallback((category: string) => {
    const categoryTools = toolsByCategory[category] || [];
    return categoryTools.length > 0 && categoryTools.every(tool => selectedTools.includes(tool.name));
  }, [toolsByCategory, selectedTools]);

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
    setExternalSelectedTools,
    getSelectedToolsCount,
    getTotalToolsCount,
    isAllSelected,
    isCategorySelected,
  };
}