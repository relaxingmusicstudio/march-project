-- Create user_consent table for opt-in enhanced tracking
CREATE TABLE IF NOT EXISTS public.user_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT UNIQUE NOT NULL,
  enhanced_analytics BOOLEAN DEFAULT false,
  marketing_emails BOOLEAN DEFAULT false,
  personalization BOOLEAN DEFAULT true,
  consent_version TEXT DEFAULT 'v1.0',
  consented_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_consent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert consent" ON public.user_consent;
-- Anyone can insert their own consent
CREATE POLICY "Anyone can insert consent"
ON public.user_consent
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view consent" ON public.user_consent;
-- Anyone can view their own consent by visitor_id
CREATE POLICY "Anyone can view consent"
ON public.user_consent
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can update consent" ON public.user_consent;
-- Anyone can update consent
CREATE POLICY "Anyone can update consent"
ON public.user_consent
FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Admins can manage consent" ON public.user_consent;
-- Admins can manage all consent
CREATE POLICY "Admins can manage consent"
ON public.user_consent
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_user_consent_updated_at ON public.user_consent;
CREATE TRIGGER update_user_consent_updated_at
BEFORE UPDATE ON public.user_consent
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster visitor_id lookups
CREATE INDEX IF NOT EXISTS idx_user_consent_visitor_id ON public.user_consent(visitor_id);
