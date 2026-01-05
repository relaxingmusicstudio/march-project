-- v30 onboarding_state persistence
CREATE TABLE IF NOT EXISTS public.onboarding_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  industry TEXT,
  service_area TEXT,
  primary_goal TEXT,
  offer_pricing TEXT,
  target_customer TEXT,
  lead_sources TEXT,
  calendar_link TEXT,
  contact_phone TEXT,
  step_completed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own onboarding_state" ON public.onboarding_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding_state" ON public.onboarding_state
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding_state" ON public.onboarding_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_onboarding_state_updated_at
  BEFORE UPDATE ON public.onboarding_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
