-- Add sales methodology tracking to agent_memories (if not exists)
ALTER TABLE public.agent_memories 
ADD COLUMN IF NOT EXISTS sales_methodology text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS methodology_effectiveness jsonb DEFAULT '{}'::jsonb;

-- Create api_logs table for gateway tracking
CREATE TABLE IF NOT EXISTS public.api_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service text NOT NULL,
  endpoint text NOT NULL,
  method text NOT NULL DEFAULT 'POST',
  request_body jsonb,
  response_status integer,
  response_time_ms integer,
  cost_cents integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on api_logs
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- Policies for api_logs (use IF NOT EXISTS pattern via DO block)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_logs' AND policyname = 'Anyone can insert api logs') THEN
    CREATE POLICY "Anyone can insert api logs" ON public.api_logs FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_logs' AND policyname = 'Admins can manage api logs') THEN
    CREATE POLICY "Admins can manage api logs" ON public.api_logs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_logs' AND policyname = 'Anyone can view api logs') THEN
    CREATE POLICY "Anyone can view api logs" ON public.api_logs FOR SELECT USING (true);
  END IF;
END $$;

-- Create deal_pipeline table for forecasting
CREATE TABLE IF NOT EXISTS public.deal_pipeline (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id),
  client_id uuid REFERENCES public.clients(id),
  name text NOT NULL,
  company text,
  value numeric NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'discovery',
  probability integer NOT NULL DEFAULT 10,
  expected_close_date date,
  days_in_stage integer DEFAULT 0,
  next_action text,
  sales_methodology text,
  buying_signals jsonb DEFAULT '[]'::jsonb,
  competitor_mentions jsonb DEFAULT '[]'::jsonb,
  sentiment_score numeric DEFAULT 0.5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on deal_pipeline
ALTER TABLE public.deal_pipeline ENABLE ROW LEVEL SECURITY;

-- Policies for deal_pipeline
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deal_pipeline' AND policyname = 'Anyone can insert deals') THEN
    CREATE POLICY "Anyone can insert deals" ON public.deal_pipeline FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deal_pipeline' AND policyname = 'Anyone can update deals') THEN
    CREATE POLICY "Anyone can update deals" ON public.deal_pipeline FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deal_pipeline' AND policyname = 'Anyone can view deals') THEN
    CREATE POLICY "Anyone can view deals" ON public.deal_pipeline FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'deal_pipeline' AND policyname = 'Admins can manage deals') THEN
    CREATE POLICY "Admins can manage deals" ON public.deal_pipeline FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Create trigger for updated_at if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_deal_pipeline_updated_at') THEN
    CREATE TRIGGER update_deal_pipeline_updated_at
    BEFORE UPDATE ON public.deal_pipeline
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;