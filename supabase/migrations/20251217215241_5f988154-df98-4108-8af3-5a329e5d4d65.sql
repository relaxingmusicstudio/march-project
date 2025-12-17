-- Add tenant_id to call_logs with backfill from leads
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill call_logs tenant_id from leads table
UPDATE public.call_logs cl
SET tenant_id = l.tenant_id
FROM public.leads l
WHERE cl.lead_id = l.id AND cl.tenant_id IS NULL AND l.tenant_id IS NOT NULL;

-- Add indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_created 
ON public.call_logs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_status_created 
ON public.call_logs(tenant_id, status, created_at DESC);

-- Add tenant_id to client_invoices with backfill from clients
ALTER TABLE public.client_invoices ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Backfill client_invoices tenant_id from clients table
UPDATE public.client_invoices ci
SET tenant_id = c.tenant_id
FROM public.clients c
WHERE ci.client_id = c.id AND ci.tenant_id IS NULL AND c.tenant_id IS NOT NULL;

-- Add indexes for tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_client_invoices_tenant_created 
ON public.client_invoices(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_invoices_tenant_status_created 
ON public.client_invoices(tenant_id, status, created_at DESC);

-- Add tenant_id to agent_cost_tracking
ALTER TABLE public.agent_cost_tracking ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- Add index for tenant-scoped cost queries
CREATE INDEX IF NOT EXISTS idx_agent_cost_tracking_tenant_created 
ON public.agent_cost_tracking(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_cost_tracking_tenant_agent 
ON public.agent_cost_tracking(tenant_id, agent_type, created_at DESC);

-- Add foreign key constraints (nullable)
ALTER TABLE public.call_logs 
ADD CONSTRAINT fk_call_logs_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.client_invoices 
ADD CONSTRAINT fk_client_invoices_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

ALTER TABLE public.agent_cost_tracking 
ADD CONSTRAINT fk_agent_cost_tracking_tenant 
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Add RLS policies for tenant isolation on call_logs
DROP POLICY IF EXISTS "Tenant isolation for call_logs" ON public.call_logs;
CREATE POLICY "Tenant isolation for call_logs" ON public.call_logs
FOR ALL USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

-- Add RLS policies for tenant isolation on client_invoices
DROP POLICY IF EXISTS "Tenant isolation for client_invoices" ON public.client_invoices;
CREATE POLICY "Tenant isolation for client_invoices" ON public.client_invoices
FOR ALL USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

-- Add RLS policies for tenant isolation on agent_cost_tracking
DROP POLICY IF EXISTS "Tenant isolation for agent_cost_tracking" ON public.agent_cost_tracking;
CREATE POLICY "Tenant isolation for agent_cost_tracking" ON public.agent_cost_tracking
FOR ALL USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);