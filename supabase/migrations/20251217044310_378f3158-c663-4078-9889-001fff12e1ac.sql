-- Add columns to tenants table
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS status tenant_status DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS initialized_at timestamptz,
  ADD COLUMN IF NOT EXISTS template_source text DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS plan tenant_plan DEFAULT 'starter';

-- Update existing tenants to active
UPDATE public.tenants SET status = 'active' WHERE status IS NULL;
UPDATE public.tenants SET template_source = 'hvac' WHERE slug = 'hvac_test';

-- Add tenant_id to ceo_action_queue
ALTER TABLE public.ceo_action_queue 
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Create index
CREATE INDEX IF NOT EXISTS idx_ceo_action_queue_tenant ON public.ceo_action_queue(tenant_id);

-- Create tenant_templates table
CREATE TABLE IF NOT EXISTS public.tenant_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  default_business_dna jsonb DEFAULT '{}',
  default_ceo_prompt text,
  default_settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_templates ENABLE ROW LEVEL SECURITY;

-- Insert default templates
INSERT INTO public.tenant_templates (template_key, display_name, description, default_business_dna, default_ceo_prompt)
VALUES 
  ('base', 'CEO in a Box', 'Industry-agnostic AI-powered business management', 
   '{"industry": "general", "business_model": "service", "sales_cycle_days": 30}',
   'You are an AI CEO assistant. Help the business owner manage and grow their company.'),
  ('hvac', 'HVAC Demo', 'Demo tenant for HVAC contractors (internal testing only)',
   '{"industry": "hvac", "business_model": "service", "avg_job_value": 351}',
   'You are an AI assistant specialized in helping HVAC contractors.')
ON CONFLICT (template_key) DO NOTHING;