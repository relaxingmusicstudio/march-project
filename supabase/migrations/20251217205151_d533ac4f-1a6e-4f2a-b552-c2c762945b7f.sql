-- CEO Decisions table for tracking executive decision-making
CREATE TABLE IF NOT EXISTS public.ceo_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id),
  decision TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  expected_impact JSONB DEFAULT '{}'::jsonb,
  actual_outcome JSONB DEFAULT NULL,
  purpose TEXT NOT NULL DEFAULT 'ceo_strategy',
  model_used TEXT,
  provider_used TEXT,
  tokens_estimated INTEGER,
  cost_estimated_cents INTEGER,
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'superseded')),
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.ceo_decisions') IS NOT NULL THEN
    ALTER TABLE public.ceo_decisions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
    ALTER TABLE public.ceo_decisions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
    ALTER TABLE public.ceo_decisions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
  END IF;
END $$;

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_ceo_decisions_tenant_created ON public.ceo_decisions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ceo_decisions_purpose ON public.ceo_decisions(purpose);
CREATE INDEX IF NOT EXISTS idx_ceo_decisions_status ON public.ceo_decisions(status);

-- Enable RLS
ALTER TABLE public.ceo_decisions ENABLE ROW LEVEL SECURITY;

-- RLS policies for ceo_decisions
DROP POLICY IF EXISTS "Users can view their tenant's decisions" ON public.ceo_decisions;
CREATE POLICY "Users can view their tenant's decisions"
  ON public.ceo_decisions
  FOR SELECT
  USING (tenant_id = public.get_user_tenant_id() OR public.is_platform_admin());

DROP POLICY IF EXISTS "System can insert decisions" ON public.ceo_decisions;
CREATE POLICY "System can insert decisions"
  ON public.ceo_decisions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their tenant's decisions" ON public.ceo_decisions;
CREATE POLICY "Users can update their tenant's decisions"
  ON public.ceo_decisions
  FOR UPDATE
  USING (tenant_id = public.get_user_tenant_id() OR public.is_platform_admin());

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_ceo_decisions_updated_at ON public.ceo_decisions;
CREATE TRIGGER update_ceo_decisions_updated_at
  BEFORE UPDATE ON public.ceo_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add purpose column to agent_cost_tracking if not exists
DO $$
BEGIN
  IF to_regclass('public.agent_cost_tracking') IS NOT NULL THEN
    ALTER TABLE public.agent_cost_tracking 
      ADD COLUMN IF NOT EXISTS purpose TEXT,
      ADD COLUMN IF NOT EXISTS model TEXT,
      ADD COLUMN IF NOT EXISTS provider TEXT;
  END IF;
END $$;

-- Create index for cost tracking by purpose
CREATE INDEX IF NOT EXISTS idx_agent_cost_tracking_purpose ON public.agent_cost_tracking(purpose);

COMMENT ON TABLE public.ceo_decisions IS 'Tracks CEO agent decisions with reasoning, confidence, and outcomes for learning loop';
