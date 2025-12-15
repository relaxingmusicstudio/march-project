-- Add environment column to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'live' 
  CHECK (environment IN ('mock', 'live', 'staging'));

-- Mock activity log for all simulated actions
CREATE TABLE IF NOT EXISTS mock_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  simulated_result JSONB NOT NULL DEFAULT '{}',
  original_payload JSONB,
  mock_response JSONB,
  latency_ms INTEGER,
  event_day INTEGER,
  simulation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE mock_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for mock_activity_log
CREATE POLICY "Users can view own tenant mock logs" ON mock_activity_log
  FOR SELECT USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Service role full access mock logs" ON mock_activity_log
  FOR ALL USING (true) WITH CHECK (true);

-- Simulation timeline events
CREATE TABLE IF NOT EXISTS simulation_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  simulation_id UUID,
  event_day INTEGER NOT NULL,
  event_time TIME DEFAULT '09:00:00',
  event_type TEXT NOT NULL,
  event_description TEXT,
  target_entity_type TEXT,
  target_entity_id UUID,
  trigger_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  executed_at TIMESTAMPTZ,
  agent_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE simulation_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant timeline" ON simulation_timeline
  FOR SELECT USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Service role full access timeline" ON simulation_timeline
  FOR ALL USING (true) WITH CHECK (true);

-- Business DNA / Profile (enhanced scenario-based)
CREATE TABLE IF NOT EXISTS business_dna (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  business_model TEXT CHECK (business_model IN ('saas', 'local_service', 'ecommerce', 'agency', 'consulting')),
  target_customer JSONB DEFAULT '{}',
  brand_voice JSONB DEFAULT '{}',
  products_services JSONB DEFAULT '[]',
  pricing_strategy JSONB DEFAULT '{}',
  competitors JSONB DEFAULT '[]',
  unique_value_proposition TEXT,
  sales_cycle_days INTEGER DEFAULT 30,
  average_deal_value NUMERIC DEFAULT 1000,
  churn_rate NUMERIC DEFAULT 0.05,
  scenario_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_dna ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant DNA" ON business_dna
  FOR SELECT USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Users can manage own tenant DNA" ON business_dna
  FOR ALL USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Service role full access DNA" ON business_dna
  FOR ALL USING (true) WITH CHECK (true);

-- A/B Test Results for mock simulations
CREATE TABLE IF NOT EXISTS ab_test_results_mock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  simulation_id UUID,
  test_name TEXT NOT NULL,
  variant_a JSONB NOT NULL,
  variant_b JSONB NOT NULL,
  variant_a_metrics JSONB DEFAULT '{"opens": 0, "clicks": 0, "conversions": 0}',
  variant_b_metrics JSONB DEFAULT '{"opens": 0, "clicks": 0, "conversions": 0}',
  winner TEXT CHECK (winner IN ('A', 'B', 'tie', 'inconclusive')),
  confidence_score NUMERIC,
  message_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ab_test_results_mock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant AB tests" ON ab_test_results_mock
  FOR SELECT USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Service role full access AB tests" ON ab_test_results_mock
  FOR ALL USING (true) WITH CHECK (true);

-- Simulation run tracking
CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  scenario_key TEXT NOT NULL,
  scenario_name TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_days_simulated INTEGER DEFAULT 180,
  current_day INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'archived')),
  speed_multiplier INTEGER DEFAULT 60,
  metrics_summary JSONB DEFAULT '{}',
  agent_responses_count INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant simulations" ON simulation_runs
  FOR SELECT USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Users can manage own tenant simulations" ON simulation_runs
  FOR ALL USING (tenant_id = get_user_tenant_id() OR tenant_id IS NULL);

CREATE POLICY "Service role full access simulations" ON simulation_runs
  FOR ALL USING (true) WITH CHECK (true);

-- Mock service credentials (sandbox keys)
CREATE TABLE IF NOT EXISTS mock_service_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT NOT NULL UNIQUE,
  service_name TEXT NOT NULL,
  sandbox_credentials JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  test_endpoint TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mock_service_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mock credentials" ON mock_service_credentials
  FOR SELECT USING (true);

CREATE POLICY "Service role full access mock credentials" ON mock_service_credentials
  FOR ALL USING (true) WITH CHECK (true);

-- Seed default mock credentials
INSERT INTO mock_service_credentials (service_key, service_name, sandbox_credentials, description, test_endpoint) VALUES
('stripe', 'Stripe Payments', '{"api_key": "sk_test_mock_key", "publishable_key": "pk_test_mock_key"}', 'Stripe Test Mode API Keys', 'https://api.stripe.com/v1/charges'),
('twilio', 'Twilio SMS/Voice', '{"account_sid": "AC_test_mock", "auth_token": "test_auth_token", "from_number": "+15005550006"}', 'Twilio Test Credentials', 'https://api.twilio.com/2010-04-01/Accounts'),
('resend', 'Resend Email', '{"api_key": "re_test_mock_key"}', 'Resend Sandbox Mode', 'https://api.resend.com/emails'),
('sendgrid', 'SendGrid Email', '{"api_key": "SG.test_mock_key"}', 'SendGrid Sandbox Mode', 'https://api.sendgrid.com/v3/mail/send'),
('openai', 'OpenAI', '{"api_key": "sk-test-mock-key"}', 'OpenAI Test Mode (returns mock responses)', NULL),
('elevenlabs', 'ElevenLabs TTS', '{"api_key": "el_test_mock_key"}', 'ElevenLabs Test Mode', NULL),
('vapi', 'Vapi Voice AI', '{"api_key": "vapi_test_mock_key", "assistant_id": "mock_assistant"}', 'Vapi Test Mode', NULL),
('did', 'D-ID Video', '{"api_key": "did_test_mock_key"}', 'D-ID Test Mode', NULL)
ON CONFLICT (service_key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mock_activity_log_tenant ON mock_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mock_activity_log_simulation ON mock_activity_log(simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_timeline_tenant ON simulation_timeline(tenant_id);
CREATE INDEX IF NOT EXISTS idx_simulation_timeline_day ON simulation_timeline(event_day);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_tenant ON simulation_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_status ON simulation_runs(status);