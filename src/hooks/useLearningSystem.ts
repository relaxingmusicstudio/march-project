import { useState, useCallback } from 'react';

interface AgentMemory {
  id: string;
  agent_type: string;
  query: string;
  response: string;
  success_score: number;
  usage_count: number;
  similarity?: number;
}

interface LearningStats {
  memory_count: number;
  avg_success_score: number;
  total_queries: number;
  cache_hit_rate: number;
  performance_history: any[];
}

export const useLearningSystem = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Search for similar memories before generating a response
  const findSimilarMemories = useCallback(async (
    query: string,
    agentType: string,
    threshold = 0.75,
    limit = 3
  ): Promise<AgentMemory[]> => {
    try {
      const response = await fetch(`${baseUrl}/functions/v1/agent-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action: 'search',
          query,
          agent_type: agentType,
          threshold,
          limit,
        }),
      });

      if (!response.ok) return [];

      const data = await response.json();
      return data.memories || [];
    } catch (err) {
      console.error('Error searching memories:', err);
      return [];
    }
  }, [baseUrl, apiKey]);

  // Save a successful interaction
  const saveSuccessfulInteraction = useCallback(async (
    agentType: string,
    query: string,
    response: string,
    metadata: Record<string, any> = {}
  ): Promise<AgentMemory | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${baseUrl}/functions/v1/agent-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action: 'save',
          agent_type: agentType,
          query,
          response,
          metadata,
        }),
      });

      if (!res.ok) throw new Error('Failed to save memory');

      const data = await res.json();
      return data.memory;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl, apiKey]);

  // Submit feedback for a memory
  const submitFeedback = useCallback(async (
    memoryId: string | null,
    agentType: string,
    query: string,
    response: string,
    feedbackType: 'positive' | 'negative',
    feedbackValue: number = feedbackType === 'positive' ? 5 : 1
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${baseUrl}/functions/v1/learn-from-success`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          memory_id: memoryId,
          agent_type: agentType,
          query,
          response,
          feedback_type: feedbackType,
          feedback_value: feedbackValue,
          feedback_source: 'user',
        }),
      });

      return res.ok;
    } catch (err) {
      console.error('Error submitting feedback:', err);
      return false;
    }
  }, [baseUrl, apiKey]);

  // Increment usage count when a cached response is used
  const incrementUsage = useCallback(async (memoryId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${baseUrl}/functions/v1/agent-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action: 'increment_usage',
          memory_id: memoryId,
        }),
      });

      return res.ok;
    } catch (err) {
      console.error('Error incrementing usage:', err);
      return false;
    }
  }, [baseUrl, apiKey]);

  // Get learning stats for an agent or all agents
  const getStats = useCallback(async (agentType?: string): Promise<LearningStats | null> => {
    try {
      const res = await fetch(`${baseUrl}/functions/v1/agent-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action: 'stats',
          agent_type: agentType,
        }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data.stats;
    } catch (err) {
      console.error('Error getting stats:', err);
      return null;
    }
  }, [baseUrl, apiKey]);

  // Delete a memory
  const deleteMemory = useCallback(async (memoryId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${baseUrl}/functions/v1/agent-memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          action: 'delete',
          memory_id: memoryId,
        }),
      });

      return res.ok;
    } catch (err) {
      console.error('Error deleting memory:', err);
      return false;
    }
  }, [baseUrl, apiKey]);

  return {
    isLoading,
    error,
    findSimilarMemories,
    saveSuccessfulInteraction,
    submitFeedback,
    incrementUsage,
    getStats,
    deleteMemory,
  };
};

export default useLearningSystem;
