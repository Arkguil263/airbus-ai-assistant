import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BriefingCache {
  flightPlan: string;
  notamAnalysis: string;
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
      console.log('🔍 Checking cache status. Cached data exists:', !!cached);
      
      if (cached) {
        const briefingCache: BriefingCache = JSON.parse(cached);
        const isValid = Date.now() - briefingCache.timestamp < CACHE_DURATION;
        console.log('📊 Cache validation:', {
          timestamp: briefingCache.timestamp,
          age: Date.now() - briefingCache.timestamp,
          maxAge: CACHE_DURATION,
          isValid,
          flightPlan: briefingCache.flightPlan?.substring(0, 50) + '...',
          notamAnalysis: briefingCache.notamAnalysis?.substring(0, 50) + '...'
        });
        
        setIsCompleted(isValid);
        return isValid;
      }
      console.log('❌ No cached data found');
      setIsCompleted(false);
    } catch (error) {
      console.error('Error checking briefing cache:', error);
      setIsCompleted(false);
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
      
      // First request: Flight plan briefing
      console.log('🚀 Making first request: Flight plan briefing');
      const timeoutPromise1 = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('First request timeout after 45 seconds')), 45000);
      });

      const fetchPromise1 = supabase.functions.invoke('unified-chat', {
        body: {
          question: "tell me about my flight plan",
          aircraftModel: "Briefing"
        }
      });

      const response1 = await Promise.race([fetchPromise1, timeoutPromise1]) as any;

      if (response1?.error) {
        throw new Error(response1.error.message || 'Failed to fetch flight plan briefing');
      }

      const flightPlanData = response1?.data?.answer || 'No flight plan data available';
      console.log('✅ First request completed');

      // Second request: NOTAM analysis
      console.log('🚀 Making second request: NOTAM analysis');
      const timeoutPromise2 = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Second request timeout after 45 seconds')), 45000);
      });

      const fetchPromise2 = supabase.functions.invoke('unified-chat', {
        body: {
          question: "Please provide full analysis of the notam, line by line please",
          aircraftModel: "Briefing"
        }
      });

      const response2 = await Promise.race([fetchPromise2, timeoutPromise2]) as any;

      if (response2?.error) {
        throw new Error(response2.error.message || 'Failed to fetch NOTAM analysis');
      }

      const notamAnalysisData = response2?.data?.answer || 'No NOTAM analysis available';
      console.log('✅ Second request completed');

      // Store both responses in cache
      const cacheData: BriefingCache = {
        flightPlan: flightPlanData,
        notamAnalysis: notamAnalysisData,
        timestamp: Date.now(),
        userId
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      setIsCompleted(true);
      console.log('✅ Both briefing requests cached successfully');

    } catch (error) {
      console.error('❌ Error auto-fetching briefing:', error);
      
      // If it's a timeout or connectivity issue, store a placeholder 
      // so the user sees the green checkmark but can still manually fetch
      if (error.message?.includes('timeout') || error.message?.includes('Edge Function')) {
        const placeholderCache: BriefingCache = {
          flightPlan: 'Flight plan briefing data will be available when you send your first message.',
          notamAnalysis: 'NOTAM analysis will be available when you send your first message.',
          timestamp: Date.now(),
          userId
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(placeholderCache));
        setIsCompleted(true);
        console.log('📝 Stored placeholder cache due to timeout');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Get cached briefing (returns combined data)
  const getCachedBriefing = (): string | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const briefingCache: BriefingCache = JSON.parse(cached);
        const isValid = Date.now() - briefingCache.timestamp < CACHE_DURATION;
        if (isValid) {
          return `${briefingCache.flightPlan}\n\n=== NOTAM ANALYSIS ===\n\n${briefingCache.notamAnalysis}`;
        }
      }
    } catch (error) {
      console.error('Error getting cached briefing:', error);
    }
    return null;
  };

  // Get individual cached components
  const getCachedFlightPlan = (): string | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const briefingCache: BriefingCache = JSON.parse(cached);
        const isValid = Date.now() - briefingCache.timestamp < CACHE_DURATION;
        if (isValid) {
          return briefingCache.flightPlan;
        }
      }
    } catch (error) {
      console.error('Error getting cached flight plan:', error);
    }
    return null;
  };

  const getCachedNotamAnalysis = (): string | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const briefingCache: BriefingCache = JSON.parse(cached);
        const isValid = Date.now() - briefingCache.timestamp < CACHE_DURATION;
        if (isValid) {
          return briefingCache.notamAnalysis;
        }
      }
    } catch (error) {
      console.error('Error getting cached NOTAM analysis:', error);
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
    getCachedFlightPlan,
    getCachedNotamAnalysis,
    clearCache,
    checkCacheStatus
  };
};