import { useState, useEffect } from 'react';
import { LLMModel } from '../types';

interface ModelsResponse {
  success: boolean;
  models: LLMModel[];
  providers: Record<string, { enabled: boolean; name: string }>;
}

export function useModels() {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [providers, setProviders] = useState<Record<string, { enabled: boolean; name: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/models');
      const data: ModelsResponse = await response.json();
      
      if (data.success) {
        setModels(data.models);
        setProviders(data.providers);
        setError(null);
      } else {
        setError('Failed to fetch models');
      }
    } catch (err) {
      setError('Network error while fetching models');
      console.error('Error fetching models:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const getModelsByProvider = () => {
    const grouped: Record<string, LLMModel[]> = {};
    models.forEach(model => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    });
    return grouped;
  };

  const getEnabledProviders = () => {
    return Object.keys(providers).filter(key => providers[key]?.enabled);
  };

  return {
    models,
    providers,
    isLoading,
    error,
    getModelsByProvider,
    getEnabledProviders,
    refetchModels: fetchModels,
  };
}