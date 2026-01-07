-- Repair core tables required by early schema (idempotent)
CREATE TABLE IF NOT EXISTS public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT UNIQUE NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_visits INTEGER DEFAULT 1,
  device TEXT,
  browser TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT REFERENCES public.visitors(visitor_id),
  session_id TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  lead_data JSONB,
  ai_analysis JSONB,
  conversation_phase TEXT,
  outcome TEXT,
  duration_seconds INTEGER,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT REFERENCES public.visitors(visitor_id),
  conversation_id UUID REFERENCES public.conversations(id),
  name TEXT,
  email TEXT,
  phone TEXT,
  business_name TEXT,
  trade TEXT,
  team_size TEXT,
  call_volume TEXT,
  timeline TEXT,
  interests TEXT[],
  lead_score INTEGER,
  lead_temperature TEXT,
  conversion_probability INTEGER,
  buying_signals TEXT[],
  objections TEXT[],
  ghl_contact_id TEXT,
  status TEXT DEFAULT 'new',
  revenue_value DECIMAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT,
  session_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB,
  page_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name TEXT NOT NULL,
  variant TEXT NOT NULL,
  visitor_id TEXT,
  converted BOOLEAN DEFAULT FALSE,
  conversion_value DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_visitors_visitor_id ON public.visitors(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON public.visitors(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_visitor_id ON public.conversations(visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON public.leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id ON public.analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at);

DROP POLICY IF EXISTS "Anyone can insert visitors" ON public.visitors;
CREATE POLICY "Anyone can insert visitors" ON public.visitors
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all visitors" ON public.visitors;
CREATE POLICY "Admins can view all visitors" ON public.visitors
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can update visitors" ON public.visitors;
CREATE POLICY "Anyone can update visitors" ON public.visitors
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can insert conversations" ON public.conversations;
CREATE POLICY "Anyone can insert conversations" ON public.conversations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update conversations" ON public.conversations;
CREATE POLICY "Anyone can update conversations" ON public.conversations
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
CREATE POLICY "Admins can view all conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
CREATE POLICY "Anyone can insert leads" ON public.leads
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins can view all leads" ON public.leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update leads" ON public.leads;
CREATE POLICY "Admins can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;
CREATE POLICY "Anyone can insert analytics events" ON public.analytics_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all analytics events" ON public.analytics_events;
CREATE POLICY "Admins can view all analytics events" ON public.analytics_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Anyone can insert ab tests" ON public.ab_tests;
CREATE POLICY "Anyone can insert ab tests" ON public.ab_tests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all ab tests" ON public.ab_tests;
CREATE POLICY "Admins can view all ab tests" ON public.ab_tests
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can update ab tests" ON public.ab_tests;
CREATE POLICY "Admins can update ab tests" ON public.ab_tests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'leads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  END IF;
END $$;
