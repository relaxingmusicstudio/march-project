-- Create accounts table for ABX
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  industry text,
  website text,
  employee_count integer,
  annual_revenue numeric,
  account_score integer DEFAULT 0,
  tier text DEFAULT 'target',
  health_score integer DEFAULT 50,
  engagement_score integer DEFAULT 0,
  last_activity_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Policies for accounts
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Anyone can view accounts') THEN
    CREATE POLICY "Anyone can view accounts" ON public.accounts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Anyone can insert accounts') THEN
    CREATE POLICY "Anyone can insert accounts" ON public.accounts FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Anyone can update accounts') THEN
    CREATE POLICY "Anyone can update accounts" ON public.accounts FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Admins can manage accounts') THEN
    CREATE POLICY "Admins can manage accounts" ON public.accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Create buying_committee table
CREATE TABLE IF NOT EXISTS public.buying_committee (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id),
  contact_id uuid REFERENCES public.contacts_unified(id),
  name text NOT NULL,
  title text,
  role_type text DEFAULT 'influencer',
  influence_level integer DEFAULT 50,
  engagement_status text DEFAULT 'unengaged',
  last_contacted_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on buying_committee
ALTER TABLE public.buying_committee ENABLE ROW LEVEL SECURITY;

-- Policies for buying_committee
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buying_committee' AND policyname = 'Anyone can view buying_committee') THEN
    CREATE POLICY "Anyone can view buying_committee" ON public.buying_committee FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buying_committee' AND policyname = 'Anyone can insert buying_committee') THEN
    CREATE POLICY "Anyone can insert buying_committee" ON public.buying_committee FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buying_committee' AND policyname = 'Anyone can update buying_committee') THEN
    CREATE POLICY "Anyone can update buying_committee" ON public.buying_committee FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'buying_committee' AND policyname = 'Admins can manage buying_committee') THEN
    CREATE POLICY "Admins can manage buying_committee" ON public.buying_committee FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Create generated_documents table
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type text NOT NULL,
  title text NOT NULL,
  template_id text,
  data jsonb DEFAULT '{}'::jsonb,
  pdf_url text,
  status text DEFAULT 'draft',
  lead_id uuid REFERENCES public.leads(id),
  client_id uuid REFERENCES public.clients(id),
  account_id uuid REFERENCES public.accounts(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on generated_documents
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

-- Policies for generated_documents
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generated_documents' AND policyname = 'Anyone can view generated_documents') THEN
    CREATE POLICY "Anyone can view generated_documents" ON public.generated_documents FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generated_documents' AND policyname = 'Anyone can insert generated_documents') THEN
    CREATE POLICY "Anyone can insert generated_documents" ON public.generated_documents FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'generated_documents' AND policyname = 'Admins can manage generated_documents') THEN
    CREATE POLICY "Admins can manage generated_documents" ON public.generated_documents FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Create system_health table for C2 monitoring
CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_unit text,
  status text DEFAULT 'healthy',
  threshold_warning numeric,
  threshold_critical numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on system_health
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- Policies for system_health
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health' AND policyname = 'Anyone can view system_health') THEN
    CREATE POLICY "Anyone can view system_health" ON public.system_health FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health' AND policyname = 'Anyone can insert system_health') THEN
    CREATE POLICY "Anyone can insert system_health" ON public.system_health FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_health' AND policyname = 'Admins can manage system_health') THEN
    CREATE POLICY "Admins can manage system_health" ON public.system_health FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Add triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_accounts_updated_at') THEN
    CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_buying_committee_updated_at') THEN
    CREATE TRIGGER update_buying_committee_updated_at BEFORE UPDATE ON public.buying_committee FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_generated_documents_updated_at') THEN
    CREATE TRIGGER update_generated_documents_updated_at BEFORE UPDATE ON public.generated_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;