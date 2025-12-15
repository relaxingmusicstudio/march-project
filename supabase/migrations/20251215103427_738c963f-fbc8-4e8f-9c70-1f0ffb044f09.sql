-- Create tenants master table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subscription_plan TEXT DEFAULT 'trial',
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Create default tenant for existing data
INSERT INTO public.tenants (id, name, slug, subscription_plan) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'default', 'professional');

-- Add tenant_id to profiles table (links users to tenants)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Add tenant_id to core business tables
ALTER TABLE public.business_profile ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.contacts_unified ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.content ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.action_queue ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.work_queue ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Create function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Create function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND tenant_id = check_tenant_id
  )
$$;

-- RLS Policies for tenants table
CREATE POLICY "Users can view their own tenant"
ON public.tenants FOR SELECT
USING (public.user_belongs_to_tenant(id));

CREATE POLICY "Admins can manage tenants"
ON public.tenants FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Tenant isolation policies for profiles
CREATE POLICY "Users can view profiles in their tenant"
ON public.profiles FOR SELECT
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for business_profile
CREATE POLICY "Tenant isolation for business_profile"
ON public.business_profile FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for leads
CREATE POLICY "Tenant isolation for leads"
ON public.leads FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for clients
CREATE POLICY "Tenant isolation for clients"
ON public.clients FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for contacts_unified
CREATE POLICY "Tenant isolation for contacts_unified"
ON public.contacts_unified FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for content
CREATE POLICY "Tenant isolation for content"
ON public.content FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for sequences
CREATE POLICY "Tenant isolation for sequences"
ON public.sequences FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for action_queue
CREATE POLICY "Tenant isolation for action_queue"
ON public.action_queue FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for work_queue
CREATE POLICY "Tenant isolation for work_queue"
ON public.work_queue FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Tenant isolation for analytics_events
CREATE POLICY "Tenant isolation for analytics_events"
ON public.analytics_events FOR ALL
USING (tenant_id = public.get_user_tenant_id() OR tenant_id IS NULL);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_business_profile_tenant_id ON public.business_profile(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant_id ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_unified_tenant_id ON public.contacts_unified(tenant_id);
CREATE INDEX IF NOT EXISTS idx_content_tenant_id ON public.content(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sequences_tenant_id ON public.sequences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_action_queue_tenant_id ON public.action_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_work_queue_tenant_id ON public.work_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_id ON public.analytics_events(tenant_id);