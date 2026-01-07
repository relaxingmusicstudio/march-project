-- Ensure pgcrypto for gen_random_bytes()
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET search_path = public, extensions;

-- Create platform_audit_log table for universal audit trail (immutable)
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_name TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  request_snapshot JSONB DEFAULT '{}'::jsonb,
  response_snapshot JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.platform_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_agent ON public.platform_audit_log(agent_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.platform_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.platform_audit_log(user_id);

-- Enable RLS
ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admins can view, service role can insert
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.platform_audit_log;
CREATE POLICY "Admins can view audit logs"
ON public.platform_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.platform_audit_log;
CREATE POLICY "Service role can insert audit logs"
ON public.platform_audit_log
FOR INSERT
WITH CHECK (true);

-- Create LLM configuration table for failover support
CREATE TABLE IF NOT EXISTS public.llm_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  api_endpoint TEXT,
  secret_key_name TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_fallback BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 10,
  last_health_check TIMESTAMPTZ,
  health_status TEXT DEFAULT 'unknown',
  failure_count INTEGER DEFAULT 0,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.llm_configuration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage LLM config" ON public.llm_configuration;
CREATE POLICY "Admins can manage LLM config"
ON public.llm_configuration
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active LLM config" ON public.llm_configuration;
CREATE POLICY "Anyone can view active LLM config"
ON public.llm_configuration
FOR SELECT
USING (is_active = true);

-- Create team_invites table
CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role app_role NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending',
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_email ON public.team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON public.team_invites(token);

-- Enable RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage invites" ON public.team_invites;
CREATE POLICY "Admins can manage invites"
ON public.team_invites
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view their own invites" ON public.team_invites;
CREATE POLICY "Users can view their own invites"
ON public.team_invites
FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Create lockdown_rules table for security sentinel
CREATE TABLE IF NOT EXISTS public.lockdown_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name TEXT NOT NULL,
  agent_type TEXT,
  action_type TEXT,
  threshold_value INTEGER NOT NULL,
  threshold_window_minutes INTEGER NOT NULL DEFAULT 60,
  lockdown_action TEXT NOT NULL DEFAULT 'pause_agent',
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lockdown_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage lockdown rules" ON public.lockdown_rules;
CREATE POLICY "Admins can manage lockdown rules"
ON public.lockdown_rules
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active rules" ON public.lockdown_rules;
CREATE POLICY "Anyone can view active rules"
ON public.lockdown_rules
FOR SELECT
USING (is_active = true);

-- Create security_lockdowns table to track active lockdowns
CREATE TABLE IF NOT EXISTS public.security_lockdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.lockdown_rules(id) ON DELETE SET NULL,
  agent_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  triggered_value INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_lockdowns_status ON public.security_lockdowns(status);
CREATE INDEX IF NOT EXISTS idx_lockdowns_agent ON public.security_lockdowns(agent_type);

-- Enable RLS
ALTER TABLE public.security_lockdowns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage lockdowns" ON public.security_lockdowns;
CREATE POLICY "Admins can manage lockdowns"
ON public.security_lockdowns
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view lockdowns" ON public.security_lockdowns;
CREATE POLICY "Anyone can view lockdowns"
ON public.security_lockdowns
FOR SELECT
USING (true);

-- Create CEO score history table
CREATE TABLE IF NOT EXISTS public.ceo_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  client_health_score INTEGER,
  revenue_health_score INTEGER,
  system_health_score INTEGER,
  task_health_score INTEGER,
  compliance_health_score INTEGER,
  breakdown JSONB DEFAULT '{}'::jsonb,
  insights TEXT[],
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceo_score_date ON public.ceo_score_history(calculated_at DESC);

-- Enable RLS
ALTER TABLE public.ceo_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage CEO scores" ON public.ceo_score_history;
CREATE POLICY "Admins can manage CEO scores"
ON public.ceo_score_history
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view CEO scores" ON public.ceo_score_history;
CREATE POLICY "Anyone can view CEO scores"
ON public.ceo_score_history
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Service role can insert CEO scores" ON public.ceo_score_history;
CREATE POLICY "Service role can insert CEO scores"
ON public.ceo_score_history
FOR INSERT
WITH CHECK (true);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_llm_configuration_updated_at ON public.llm_configuration;
CREATE TRIGGER update_llm_configuration_updated_at
  BEFORE UPDATE ON public.llm_configuration
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_lockdown_rules_updated_at ON public.lockdown_rules;
CREATE TRIGGER update_lockdown_rules_updated_at
  BEFORE UPDATE ON public.lockdown_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default LLM configuration
INSERT INTO public.llm_configuration (provider, model_name, api_endpoint, secret_key_name, is_primary, priority) VALUES
('lovable', 'google/gemini-2.5-flash', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'LOVABLE_API_KEY', true, 1),
('lovable', 'google/gemini-2.5-pro', 'https://ai.gateway.lovable.dev/v1/chat/completions', 'LOVABLE_API_KEY', false, 2),
('openai', 'gpt-4o-mini', 'https://api.openai.com/v1/chat/completions', 'OPENAI_API_KEY', false, 10);

-- Seed default lockdown rules
INSERT INTO public.lockdown_rules (rule_name, agent_type, action_type, threshold_value, threshold_window_minutes, lockdown_action) VALUES
('Email Flood Protection', 'email', 'send', 100, 60, 'pause_agent'),
('API Call Limit', NULL, 'api_call', 1000, 60, 'alert_only'),
('Ad Spend Protection', 'ads', 'spend', 50000, 1440, 'pause_agent'),
('Mass SMS Prevention', 'sms', 'send', 500, 60, 'pause_agent'),
('Database Write Storm', NULL, 'db_write', 5000, 60, 'alert_only');
