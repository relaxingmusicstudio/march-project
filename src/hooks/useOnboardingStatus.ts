/**
 * Hook to check if user has completed onboarding
 * Used for #5: Conversation-first for NEW users only
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useOnboardingStatus() {
  const { user, isLoading: authLoading } = useAuth();
  const tenantId = user?.user_metadata?.tenant_id;
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkOnboarding = useCallback(async () => {
    if (!user) {
      setIsOnboardingComplete(null);
      setIsLoading(false);
      return;
    }

    try {
      // Check business_profile for onboarding_completed_at
      const { data: profile } = await supabase
        .from("business_profile")
        .select("onboarding_completed_at")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      // User has completed onboarding if they have a profile with completed timestamp
      const completed = !!(profile?.onboarding_completed_at);
      setIsOnboardingComplete(completed);
    } catch (error) {
      console.error("Error checking onboarding status:", error);
      // Default to complete on error to not block returning users
      setIsOnboardingComplete(true);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    checkOnboarding();
  }, [authLoading, checkOnboarding]);

  const refetch = useCallback(() => {
    setIsLoading(true);
    checkOnboarding();
  }, [checkOnboarding]);

  return {
    isOnboardingComplete: isOnboardingComplete ?? false,
    isLoading: authLoading || isLoading,
    isNewUser: isOnboardingComplete === false,
    refetch,
  };
}

