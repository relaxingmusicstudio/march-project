-- Minimal schema for decision diagnostics and write checks.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.ceo_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  purpose TEXT NOT NULL DEFAULT 'ceo_strategy',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'superseded')),
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  actual_outcome JSONB,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceo_decisions_created_at ON public.ceo_decisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ceo_decisions_status ON public.ceo_decisions(status);
CREATE INDEX IF NOT EXISTS idx_ceo_decisions_purpose ON public.ceo_decisions(purpose);
