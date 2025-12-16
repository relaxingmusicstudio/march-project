-- Business templates (master definitions for different industries)
CREATE TABLE public.business_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  category TEXT DEFAULT 'home_services',
  base_config JSONB NOT NULL DEFAULT '{}',
  ai_system_prompt TEXT,
  default_services JSONB DEFAULT '[]',
  default_statistics JSONB DEFAULT '{}',
  features_included TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Environment deployments tracking
CREATE TABLE public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.business_templates(id),
  environment TEXT NOT NULL CHECK (environment IN ('dev', 'staging', 'production')),
  config_overrides JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'deploying', 'active', 'failed', 'archived')),
  deployed_at TIMESTAMPTZ,
  deployed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for business_templates
CREATE POLICY "Anyone can view active templates" ON public.business_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage templates" ON public.business_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access templates" ON public.business_templates
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies for deployments
CREATE POLICY "Users can view own tenant deployments" ON public.deployments
  FOR SELECT USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Admins can manage deployments" ON public.deployments
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access deployments" ON public.deployments
  FOR ALL USING (true) WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_business_templates_key ON public.business_templates(template_key);
CREATE INDEX idx_business_templates_industry ON public.business_templates(industry);
CREATE INDEX idx_deployments_tenant ON public.deployments(tenant_id);
CREATE INDEX idx_deployments_status ON public.deployments(status);

-- Trigger for updated_at
CREATE TRIGGER update_business_templates_updated_at
  BEFORE UPDATE ON public.business_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deployments_updated_at
  BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial templates
INSERT INTO public.business_templates (template_key, display_name, industry, category, base_config, ai_system_prompt, default_services, default_statistics, features_included) VALUES
-- HVAC Template
('hvac', 'HVAC Business', 'hvac', 'home_services', 
  '{"brand_colors": {"primary": "#2563eb", "secondary": "#1e40af"}, "default_job_value": 351, "emergency_premium": 1.5}'::jsonb,
  'You are Alex, a friendly and professional AI receptionist for an HVAC company. You help homeowners with heating and cooling emergencies, schedule service appointments, and answer questions about AC repair, furnace maintenance, and system installations. You''re knowledgeable about the $156B HVAC industry and understand that 27% of calls go unanswered by competitors.',
  '[{"name": "AC Repair", "price_range": "$150-$500"}, {"name": "Heating Repair", "price_range": "$150-$600"}, {"name": "System Installation", "price_range": "$5,000-$15,000"}, {"name": "Maintenance Plans", "price_range": "$199-$399/year"}, {"name": "Emergency Service", "price_range": "1.5x standard"}]'::jsonb,
  '{"market_size": "$156.2B", "missed_call_rate": "27%", "avg_repair_cost": 351, "customer_ltv": 15340, "technician_shortage": 110000, "voicemail_abandon_rate": "80%"}'::jsonb,
  ARRAY['voice_agent', 'sms_followup', 'appointment_booking', 'emergency_dispatch', 'maintenance_reminders']
),
-- Plumbing Template
('plumbing', 'Plumbing Business', 'plumbing', 'home_services',
  '{"brand_colors": {"primary": "#0891b2", "secondary": "#0e7490"}, "default_job_value": 290, "emergency_premium": 1.75}'::jsonb,
  'You are Alex, a friendly and professional AI receptionist for a plumbing company. You help homeowners with plumbing emergencies like burst pipes, clogged drains, and water heater issues. You schedule appointments and provide helpful information about plumbing services.',
  '[{"name": "Drain Cleaning", "price_range": "$150-$350"}, {"name": "Pipe Repair", "price_range": "$200-$800"}, {"name": "Water Heater Service", "price_range": "$150-$2,500"}, {"name": "Sewer Line Service", "price_range": "$500-$5,000"}, {"name": "Emergency Service", "price_range": "1.75x standard"}]'::jsonb,
  '{"market_size": "$130B", "missed_call_rate": "23%", "avg_job_value": 290, "customer_ltv": 12500, "emergency_rate": "35%"}'::jsonb,
  ARRAY['voice_agent', 'sms_followup', 'appointment_booking', 'emergency_dispatch']
),
-- Solar Template
('solar', 'Solar Installation', 'solar', 'home_services',
  '{"brand_colors": {"primary": "#f59e0b", "secondary": "#d97706"}, "default_job_value": 25000, "consultation_fee": 0}'::jsonb,
  'You are Alex, a friendly and knowledgeable AI consultant for a solar installation company. You help homeowners understand solar benefits, schedule free consultations, and answer questions about energy savings, tax credits, and installation process.',
  '[{"name": "Residential Solar", "price_range": "$15,000-$35,000"}, {"name": "Commercial Solar", "price_range": "$50,000-$500,000"}, {"name": "Battery Storage", "price_range": "$8,000-$15,000"}, {"name": "Solar Maintenance", "price_range": "$200-$500/year"}]'::jsonb,
  '{"market_size": "$42B", "missed_call_rate": "18%", "avg_installation": 25000, "tax_credit": "30%", "payback_years": "6-8"}'::jsonb,
  ARRAY['voice_agent', 'sms_followup', 'consultation_booking', 'roi_calculator', 'proposal_generator']
),
-- Roofing Template
('roofing', 'Roofing Business', 'roofing', 'home_services',
  '{"brand_colors": {"primary": "#dc2626", "secondary": "#b91c1c"}, "default_job_value": 8500, "storm_premium": 1.25}'::jsonb,
  'You are Alex, a friendly and professional AI receptionist for a roofing company. You help homeowners with roof repairs, storm damage assessment, and full roof replacements. You schedule inspections and provide information about roofing materials and warranties.',
  '[{"name": "Roof Inspection", "price_range": "$150-$300"}, {"name": "Roof Repair", "price_range": "$300-$1,500"}, {"name": "Full Replacement", "price_range": "$8,000-$25,000"}, {"name": "Storm Damage", "price_range": "Insurance + deductible"}, {"name": "Gutter Service", "price_range": "$200-$800"}]'::jsonb,
  '{"market_size": "$56B", "missed_call_rate": "31%", "avg_job_value": 8500, "storm_surge": "400%", "insurance_claims": "65%"}'::jsonb,
  ARRAY['voice_agent', 'sms_followup', 'inspection_booking', 'insurance_assistance', 'storm_tracking']
),
-- Electrical Template
('electrical', 'Electrical Services', 'electrical', 'home_services',
  '{"brand_colors": {"primary": "#7c3aed", "secondary": "#6d28d9"}, "default_job_value": 375, "emergency_premium": 1.5}'::jsonb,
  'You are Alex, a friendly and professional AI receptionist for an electrical services company. You help homeowners with electrical repairs, panel upgrades, and EV charger installations. You prioritize safety and schedule appointments efficiently.',
  '[{"name": "Electrical Repair", "price_range": "$150-$500"}, {"name": "Panel Upgrade", "price_range": "$1,500-$4,000"}, {"name": "EV Charger Install", "price_range": "$500-$2,000"}, {"name": "Whole Home Rewiring", "price_range": "$8,000-$20,000"}, {"name": "Emergency Service", "price_range": "1.5x standard"}]'::jsonb,
  '{"market_size": "$180B", "missed_call_rate": "25%", "avg_job_value": 375, "ev_growth": "45%", "smart_home_demand": "growing"}'::jsonb,
  ARRAY['voice_agent', 'sms_followup', 'appointment_booking', 'emergency_dispatch', 'safety_inspections']
);