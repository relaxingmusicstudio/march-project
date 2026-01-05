import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  buildOnboardingState,
  clearOnboardingState,
  defaultOnboardingState,
  loadOnboardingState,
  OnboardingData,
  OnboardingState,
  OnboardingStatus,
  ONBOARDING_TOTAL_STEPS,
  saveOnboardingState,
} from "@/lib/onboarding";

type OnboardingRow = {
  user_id: string;
  business_name: string | null;
  industry: string | null;
  service_area: string | null;
  primary_goal: string | null;
  offer_pricing: string | null;
  target_customer: string | null;
  lead_sources: string | null;
  calendar_link: string | null;
  contact_phone: string | null;
  step_completed: number | null;
  updated_at: string | null;
};

type RemoteRowStatus = "unknown" | "missing" | "present";

let sharedOnboardingState: OnboardingState = defaultOnboardingState;
const onboardingSubscribers = new Set<(state: OnboardingState) => void>();

const broadcastOnboardingState = (next: OnboardingState) => {
  sharedOnboardingState = next;
  onboardingSubscribers.forEach((listener) => listener(next));
};

const rowToState = (row: OnboardingRow): OnboardingState =>
  buildOnboardingState(
    {
      businessName: row.business_name ?? "",
      industry: row.industry ?? "",
      serviceArea: row.service_area ?? "",
      primaryGoal: row.primary_goal ?? "",
      offerPricing: row.offer_pricing ?? "",
      targetCustomer: row.target_customer ?? "",
      leadSources: row.lead_sources ?? "",
      calendarLink: row.calendar_link ?? "",
      contactPhone: row.contact_phone ?? "",
    },
    row.step_completed ?? 0,
    row.updated_at ?? null
  );

const buildRemotePayload = (userId: string, state: OnboardingState) => ({
  user_id: userId,
  business_name: state.data.businessName || null,
  industry: state.data.industry || null,
  service_area: state.data.serviceArea || null,
  primary_goal: state.data.primaryGoal || null,
  offer_pricing: state.data.offerPricing || null,
  target_customer: state.data.targetCustomer || null,
  lead_sources: state.data.leadSources || null,
  calendar_link: state.data.calendarLink || null,
  contact_phone: state.data.contactPhone || null,
  step_completed: state.stepCompleted,
  updated_at: state.updatedAt ?? new Date().toISOString(),
});

export function useOnboardingStatus() {
  const { userId, email, isLoading: authLoading } = useAuth();
  const storageKey = useMemo(() => `${userId || email || "anonymous"}`, [userId, email]);
  const isMockAuth =
    import.meta.env.VITE_MOCK_AUTH === "true" ||
    (typeof window !== "undefined" && window.localStorage.getItem("VITE_MOCK_AUTH") === "true");

  const [state, setState] = useState<OnboardingState>(sharedOnboardingState);
  const [hydrated, setHydrated] = useState(false);
  const remoteRowStatusRef = useRef<RemoteRowStatus>("unknown");

  useEffect(() => {
    const listener = (next: OnboardingState) => setState(next);
    onboardingSubscribers.add(listener);
    return () => {
      onboardingSubscribers.delete(listener);
    };
  }, []);

  const persistRemote = useCallback(
    async (next: OnboardingState) => {
      if (!userId || isMockAuth) return;
      if (remoteRowStatusRef.current === "missing" && next.stepCompleted === 0) {
        console.info("[onboarding] remote skip (no row, step 0)");
        return;
      }
      const payload = buildRemotePayload(userId, next);
      const { data, error } = await supabase
        .from("onboarding_state")
        .upsert(payload, { onConflict: "user_id" })
        .select("*")
        .single();
      console.info("[onboarding] upsert", { ok: !error, data, error });
      if (error) {
        console.warn("[onboarding] remote upsert failed", error);
        return;
      }
      remoteRowStatusRef.current = "present";
    },
    [userId, isMockAuth]
  );

  const persist = useCallback(
    (next: OnboardingState) => {
      setState(next);
      broadcastOnboardingState(next);
      saveOnboardingState(next, userId, email);
      void persistRemote(next);
    },
    [userId, email, persistRemote]
  );

  useEffect(() => {
    if (authLoading) return;

    const localFallback = loadOnboardingState(userId, email);
    const missingFallback = defaultOnboardingState;

    if (!userId || isMockAuth) {
      setState(localFallback);
      broadcastOnboardingState(localFallback);
      setHydrated(true);
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      try {
        const { data, error } = await supabase
          .from("onboarding_state")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        const row = (data as OnboardingRow | null) ?? null;
        console.info("[onboarding] select", {
          ok: true,
          found: Boolean(row),
          step_completed: row?.step_completed ?? null,
        });
        remoteRowStatusRef.current = row ? "present" : "missing";

        const next = row ? rowToState(row) : missingFallback;
        if (!cancelled) {
          setState(next);
          broadcastOnboardingState(next);
          saveOnboardingState(next, userId, email);
          setHydrated(true);
        }
      } catch (error) {
        console.warn("[onboarding] remote hydrate failed", error);
        if (!cancelled) {
          setState(localFallback);
          broadcastOnboardingState(localFallback);
          saveOnboardingState(localFallback, userId, email);
          setHydrated(true);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, email, storageKey, isMockAuth]);

  const updateData = useCallback(
    (partial: Partial<OnboardingData>) => {
      const next = buildOnboardingState(
        { ...state.data, ...partial },
        state.stepCompleted,
        new Date().toISOString()
      );
      persist(next);
    },
    [state, persist]
  );

  const advanceStep = useCallback(
    (partial: Partial<OnboardingData>, stepCompleted: number) => {
      const nextStep = Math.max(state.stepCompleted, stepCompleted);
      const next = buildOnboardingState({ ...state.data, ...partial }, nextStep, new Date().toISOString());
      persist(next);
    },
    [state, persist]
  );

  const markStatus = useCallback(
    (status: OnboardingStatus) => {
      const stepCompleted =
        status === "complete"
          ? ONBOARDING_TOTAL_STEPS
          : status === "not_started"
            ? 0
            : Math.max(state.stepCompleted, 1);
      const next = buildOnboardingState(state.data, stepCompleted, new Date().toISOString());
      persist(next);
    },
    [state, persist]
  );

  const markComplete = useCallback(() => markStatus("complete"), [markStatus]);
  const completeWithData = useCallback(
    (data: OnboardingData) => {
      const next = buildOnboardingState(
        { ...state.data, ...data },
        ONBOARDING_TOTAL_STEPS,
        new Date().toISOString()
      );
      persist(next);
    },
    [state.data, persist]
  );

  const reset = useCallback(() => {
    clearOnboardingState(userId, email);
    const next = buildOnboardingState({}, 0, new Date().toISOString());
    persist(next);
    setHydrated(true);
  }, [userId, email, persist]);

  return {
    status: state.status,
    data: state.data,
    stepCompleted: state.stepCompleted,
    updatedAt: state.updatedAt,
    isOnboardingComplete: state.stepCompleted >= ONBOARDING_TOTAL_STEPS,
    isLoading: authLoading || !hydrated,
    updateData,
    advanceStep,
    markStatus,
    markComplete,
    completeWithData,
    reset,
  };
}

export default useOnboardingStatus;
