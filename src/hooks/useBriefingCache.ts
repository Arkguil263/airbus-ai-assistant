import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BriefingCache {
  content: string;
  timestamp: number;
  userId: string;
}

const CACHE_KEY = 'briefing_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const useBriefingCache = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Check if briefing is already cached and valid
  const checkCacheStatus = () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const briefingCache: BriefingCache = JSON.parse(cached);
        const isValid = Date.now() - briefingCache.timestamp < CACHE_DURATION;
        setIsCompleted(isValid);
        return isValid;
      }
    } catch (error) {
      console.error('Error checking briefing cache:', error);
    }
    return false;
  };

  // Auto-fetch briefing when user logs in
  const autoFetchBriefing = async (userId: string) => {
    // First check if we already have valid cache
    if (checkCacheStatus()) {
      console.log('Briefing already cached and valid');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Auto-fetching briefing for user:', userId);
      
      // Use unified-chat instead of briefing-assistant for consistency
      const response = await supabase.functions.invoke('unified-chat', {
        body: {
          question: "tell me about my flight plan",
          aircraftModel: "Briefing"
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch briefing');
      }

      const briefingData = response.data;
      const cacheData: BriefingCache = {
        content: briefingData.answer || 'No briefing data available',
        timestamp: Date.now(),
        userId
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      setIsCompleted(true);
      console.log('✅ Briefing cached successfully');

    } catch (error) {
      console.error('❌ Error auto-fetching briefing:', error);
      // Don't set error state - just silently fail and let user trigger manually
    } finally {
      setIsLoading(false);
    }
  };

  // Get cached briefing
  const getCachedBriefing = (): string | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const briefingCache: BriefingCache = JSON.parse(cached);
        const isValid = Date.now() - briefingCache.timestamp < CACHE_DURATION;
        if (isValid) {
          return briefingCache.content;
        }
      }
    } catch (error) {
      console.error('Error getting cached briefing:', error);
    }
    return null;
  };

  // Clear cache
  const clearCache = () => {
    localStorage.removeItem(CACHE_KEY);
    setIsCompleted(false);
  };

  // Initialize cache status on mount
  useEffect(() => {
    checkCacheStatus();
  }, []);

  return {
    isLoading,
    isCompleted,
    autoFetchBriefing,
    getCachedBriefing,
    clearCache,
    checkCacheStatus
  };
};