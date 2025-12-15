-- CEO Autopilot Mode Configuration
CREATE TABLE IF NOT EXISTS public.ceo_autopilot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active BOOLEAN DEFAULT false,
  absence_start TIMESTAMPTZ,
  absence_end TIMESTAMPTZ,
  escalation_phone TEXT,
  escalation_email TEXT,
  max_auto_refund_cents INTEGER DEFAULT 50000,
  max_auto_discount_percent INTEGER DEFAULT 20,
  auto_respond_clients BOOLEAN DEFAULT true,
  auto_execute_followups BOOLEAN DEFAULT true,
  auto_manage_campaigns BOOLEAN DEFAULT true,
  notify_on_execution BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config if not exists
INSERT INTO public.ceo_autopilot_config (id, is_active) 
SELECT gen_random_uuid(), false
WHERE NOT EXISTS (SELECT 1 FROM public.ceo_autopilot_config LIMIT 1);

-- Auto-Execution Log (audit trail)
CREATE TABLE IF NOT EXISTS public.ceo_auto_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standing_order_id UUID REFERENCES public.ceo_standing_orders(id),
  action_type TEXT NOT NULL,
  action_payload JSONB,
  trigger_data JSONB,
  result JSONB,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  notified_ceo BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.ceo_autopilot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_auto_executions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can manage autopilot config" ON public.ceo_autopilot_config
  FOR ALL USING (true);
  
CREATE POLICY "Authenticated users can view auto executions" ON public.ceo_auto_executions
  FOR ALL USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_executions_date ON public.ceo_auto_executions(executed_at DESC);

-- Realtime for auto-executions
ALTER PUBLICATION supabase_realtime ADD TABLE public.ceo_auto_executions;