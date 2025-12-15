-- ═══════════════════════════════════════════════════════════════════════════
-- INTEGRATION CORE: Complete Credential Vault, Service Registry & Agent Permissions
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══ PHASE 1: CREDENTIAL VAULT (Encrypted Storage) ═══

-- Table: service_credentials - Encrypted credential storage with OAuth support
CREATE TABLE public.service_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT NOT NULL UNIQUE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('oauth2', 'api_key', 'basic_auth', 'webhook')),
  encrypted_value TEXT NOT NULL,
  encryption_key_version INT DEFAULT 1,
  
  -- OAuth-specific fields
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMPTZ,
  oauth_scopes TEXT[],
  
  -- Health monitoring
  connection_status TEXT DEFAULT 'unknown' CHECK (connection_status IN ('healthy', 'degraded', 'expired', 'revoked', 'unknown')),
  last_health_check TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  last_used_by_agent TEXT,
  total_usage_count INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.service_credentials ENABLE ROW LEVEL SECURITY;

-- Only admins can manage credentials
CREATE POLICY "Admins only for service_credentials" 
ON public.service_credentials FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role has full access (for edge functions)
CREATE POLICY "Service role full access to service_credentials"
ON public.service_credentials FOR ALL
USING (true)
WITH CHECK (true);

-- Table: credential_usage_log - Audit trail for credential access
CREATE TABLE public.credential_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID REFERENCES public.service_credentials(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('read', 'decrypt', 'refresh', 'test', 'revoke', 'create', 'update')),
  purpose TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.credential_usage_log ENABLE ROW LEVEL SECURITY;

-- Admins can view usage logs
CREATE POLICY "Admins can view credential_usage_log"
ON public.credential_usage_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert logs
CREATE POLICY "Service role can manage credential_usage_log"
ON public.credential_usage_log FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for fast lookups
CREATE INDEX idx_credential_usage_agent ON public.credential_usage_log(agent_name, created_at DESC);
CREATE INDEX idx_credentials_status ON public.service_credentials(connection_status);
CREATE INDEX idx_credentials_service_key ON public.service_credentials(service_key);

-- ═══ PHASE 2: SERVICE KNOWLEDGE GRAPH ═══

-- Table: service_registry - Metadata for all integrable services
CREATE TABLE public.service_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('marketing', 'finance', 'communication', 'video', 'crm', 'analytics', 'storage', 'ecommerce', 'productivity')),
  icon_emoji TEXT DEFAULT '🔌',
  description TEXT,
  
  -- Connection method
  auth_method TEXT NOT NULL CHECK (auth_method IN ('oauth2', 'api_key', 'basic_auth', 'webhook', 'none')),
  oauth_authorize_url TEXT,
  oauth_token_url TEXT,
  oauth_scopes_available TEXT[],
  oauth_scopes_required TEXT[],
  
  -- Setup guidance for CEO Agent
  setup_instructions JSONB DEFAULT '[]'::jsonb,
  credential_fields JSONB DEFAULT '[]'::jsonb,
  test_endpoint TEXT,
  test_method TEXT DEFAULT 'GET',
  
  -- Metadata
  documentation_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  priority_order INT DEFAULT 50,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.service_registry ENABLE ROW LEVEL SECURITY;

-- Anyone can view service registry
CREATE POLICY "Anyone can view service_registry"
ON public.service_registry FOR SELECT
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage service_registry"
ON public.service_registry FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Table: service_relationships - Smart suggestion graph
CREATE TABLE public.service_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_service TEXT NOT NULL,
  target_service TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('recommends', 'requires', 'enhances', 'replaces', 'conflicts')),
  priority INT DEFAULT 50,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_service, target_service, relationship_type)
);

-- Enable RLS
ALTER TABLE public.service_relationships ENABLE ROW LEVEL SECURITY;

-- Anyone can view relationships
CREATE POLICY "Anyone can view service_relationships"
ON public.service_relationships FOR SELECT
USING (true);

-- Table: integration_templates - Business-type setup bundles
CREATE TABLE public.integration_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  icon_emoji TEXT DEFAULT '📦',
  recommended_services TEXT[],
  required_services TEXT[],
  setup_order TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.integration_templates ENABLE ROW LEVEL SECURITY;

-- Anyone can view templates
CREATE POLICY "Anyone can view integration_templates"
ON public.integration_templates FOR SELECT
USING (true);

-- ═══ PHASE 3: AGENT PERMISSION PROTOCOL ═══

-- Table: agent_permissions - Access control for agents
CREATE TABLE public.agent_integration_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  required_services TEXT[] DEFAULT '{}',
  allowed_services TEXT[] DEFAULT '{}',
  allowed_actions JSONB DEFAULT '{}'::jsonb,
  max_daily_api_calls INT DEFAULT 1000,
  max_cost_per_day_cents INT DEFAULT 500,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_integration_permissions ENABLE ROW LEVEL SECURITY;

-- Anyone can view permissions
CREATE POLICY "Anyone can view agent_integration_permissions"
ON public.agent_integration_permissions FOR SELECT
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage agent_integration_permissions"
ON public.agent_integration_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role access
CREATE POLICY "Service role full access to agent_integration_permissions"
ON public.agent_integration_permissions FOR ALL
USING (true)
WITH CHECK (true);

-- Table: permission_violations - Log unauthorized access attempts
CREATE TABLE public.integration_permission_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  attempted_service TEXT NOT NULL,
  attempted_action TEXT,
  violation_type TEXT CHECK (violation_type IN ('no_credential', 'service_denied', 'action_denied', 'rate_exceeded', 'cost_exceeded')),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.integration_permission_violations ENABLE ROW LEVEL SECURITY;

-- Admins can view violations
CREATE POLICY "Admins can view integration_permission_violations"
ON public.integration_permission_violations FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert violations
CREATE POLICY "Service role can manage integration_permission_violations"
ON public.integration_permission_violations FOR ALL
USING (true)
WITH CHECK (true);

-- ═══ SEED DATA: 15+ Services ═══

INSERT INTO public.service_registry (service_key, display_name, category, icon_emoji, description, auth_method, oauth_authorize_url, oauth_token_url, oauth_scopes_required, setup_instructions, credential_fields, test_endpoint, documentation_url, priority_order) VALUES
-- Analytics
('google_analytics', 'Google Analytics', 'analytics', '📊', 'Track website traffic and user behavior', 'oauth2', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['analytics.readonly'], '[{"step": 1, "title": "Enable Google Analytics API", "description": "Go to Google Cloud Console and enable the Analytics API"}, {"step": 2, "title": "Create OAuth credentials", "description": "Create OAuth 2.0 credentials for web application"}]'::jsonb, '[]'::jsonb, 'https://analyticsreporting.googleapis.com/v4/reports:batchGet', 'https://developers.google.com/analytics', 10),

-- Marketing
('google_ads', 'Google Ads', 'marketing', '📢', 'Manage Google advertising campaigns', 'oauth2', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['https://www.googleapis.com/auth/adwords'], '[{"step": 1, "title": "Get Developer Token", "description": "Apply for Google Ads API developer token"}]'::jsonb, '[]'::jsonb, 'https://googleads.googleapis.com/v14/customers', 'https://developers.google.com/google-ads/api/docs', 15),

('meta_ads', 'Meta Ads (Facebook/Instagram)', 'marketing', '📘', 'Manage Facebook and Instagram advertising', 'oauth2', 'https://www.facebook.com/v18.0/dialog/oauth', 'https://graph.facebook.com/v18.0/oauth/access_token', ARRAY['ads_management', 'ads_read'], '[{"step": 1, "title": "Create Meta App", "description": "Create an app in Meta for Developers"}, {"step": 2, "title": "Add Marketing API", "description": "Add the Marketing API to your app"}]'::jsonb, '[]'::jsonb, 'https://graph.facebook.com/v18.0/me', 'https://developers.facebook.com/docs/marketing-apis', 20),

-- Finance
('stripe', 'Stripe', 'finance', '💳', 'Process payments and manage subscriptions', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get API Keys", "description": "Go to Stripe Dashboard → Developers → API keys"}, {"step": 2, "title": "Copy Secret Key", "description": "Copy your secret key (starts with sk_)"}]'::jsonb, '[{"name": "api_key", "label": "Secret Key", "placeholder": "sk_live_...", "type": "password"}]'::jsonb, 'https://api.stripe.com/v1/balance', 'https://stripe.com/docs/api', 5),

('quickbooks', 'QuickBooks', 'finance', '📗', 'Accounting and bookkeeping automation', 'oauth2', 'https://appcenter.intuit.com/connect/oauth2', 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', ARRAY['com.intuit.quickbooks.accounting'], '[{"step": 1, "title": "Create Intuit App", "description": "Register at developer.intuit.com"}, {"step": 2, "title": "Configure OAuth", "description": "Set redirect URI to your callback URL"}]'::jsonb, '[]'::jsonb, 'https://quickbooks.api.intuit.com/v3/company', 'https://developer.intuit.com/app/developer/qbo/docs', 25),

('plaid', 'Plaid', 'finance', '🏦', 'Bank account connectivity and transactions', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get API Keys", "description": "Sign up at plaid.com and get your API keys"}, {"step": 2, "title": "Copy Client ID and Secret", "description": "Get both client_id and secret from dashboard"}]'::jsonb, '[{"name": "client_id", "label": "Client ID", "type": "text"}, {"name": "secret", "label": "Secret", "type": "password"}]'::jsonb, 'https://production.plaid.com/institutions/get', 'https://plaid.com/docs', 30),

-- Communication
('twilio', 'Twilio', 'communication', '📱', 'SMS, voice calls, and WhatsApp messaging', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get Account SID", "description": "Find your Account SID in Twilio Console"}, {"step": 2, "title": "Get Auth Token", "description": "Copy your Auth Token from the same page"}]'::jsonb, '[{"name": "account_sid", "label": "Account SID", "type": "text"}, {"name": "auth_token", "label": "Auth Token", "type": "password"}]'::jsonb, 'https://api.twilio.com/2010-04-01/Accounts', 'https://www.twilio.com/docs', 8),

('resend', 'Resend', 'communication', '📧', 'Transactional email delivery', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get API Key", "description": "Go to Resend dashboard → API Keys → Create"}, {"step": 2, "title": "Verify Domain", "description": "Add DNS records for your sending domain"}]'::jsonb, '[{"name": "api_key", "label": "API Key", "type": "password"}]'::jsonb, 'https://api.resend.com/domains', 'https://resend.com/docs', 12),

('vapi', 'Vapi', 'communication', '🎙️', 'AI voice agents and phone automation', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get API Key", "description": "Go to Vapi dashboard → Settings → API Keys"}]'::jsonb, '[{"name": "api_key", "label": "API Key", "type": "password"}, {"name": "public_key", "label": "Public Key", "type": "text"}]'::jsonb, 'https://api.vapi.ai/assistant', 'https://docs.vapi.ai', 6),

-- Video Production
('elevenlabs', 'ElevenLabs', 'video', '🔊', 'AI voice synthesis and cloning', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get API Key", "description": "Go to ElevenLabs → Profile → API Key"}]'::jsonb, '[{"name": "api_key", "label": "API Key", "type": "password"}]'::jsonb, 'https://api.elevenlabs.io/v1/voices', 'https://docs.elevenlabs.io', 35),

('did', 'D-ID', 'video', '🎭', 'AI avatar video generation', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get API Key", "description": "Go to D-ID Studio → Settings → API"}]'::jsonb, '[{"name": "api_key", "label": "API Key", "type": "password"}]'::jsonb, 'https://api.d-id.com/talks', 'https://docs.d-id.com', 40),

('heygen', 'HeyGen', 'video', '🎬', 'AI video creation with avatars', 'api_key', NULL, NULL, NULL, '[{"step": 1, "title": "Get API Key", "description": "Go to HeyGen → Settings → API"}]'::jsonb, '[{"name": "api_key", "label": "API Key", "type": "password"}]'::jsonb, 'https://api.heygen.com/v1/avatars', 'https://docs.heygen.com', 42),

-- Ecommerce
('shopify', 'Shopify', 'ecommerce', '🛒', 'Ecommerce platform integration', 'oauth2', 'https://{shop}.myshopify.com/admin/oauth/authorize', 'https://{shop}.myshopify.com/admin/oauth/access_token', ARRAY['read_products', 'read_orders'], '[{"step": 1, "title": "Create Custom App", "description": "Go to Shopify Admin → Apps → Develop apps"}, {"step": 2, "title": "Configure Scopes", "description": "Select the API scopes you need"}]'::jsonb, '[{"name": "shop_domain", "label": "Shop Domain", "placeholder": "mystore.myshopify.com", "type": "text"}]'::jsonb, 'https://{shop}.myshopify.com/admin/api/2024-01/shop.json', 'https://shopify.dev/docs/api', 22),

-- Productivity
('google_calendar', 'Google Calendar', 'productivity', '📅', 'Calendar and scheduling integration', 'oauth2', 'https://accounts.google.com/o/oauth2/v2/auth', 'https://oauth2.googleapis.com/token', ARRAY['https://www.googleapis.com/auth/calendar.readonly'], '[{"step": 1, "title": "Enable Calendar API", "description": "Enable in Google Cloud Console"}]'::jsonb, '[]'::jsonb, 'https://www.googleapis.com/calendar/v3/calendars/primary', 'https://developers.google.com/calendar', 45),

('ghl', 'GoHighLevel', 'crm', '🚀', 'All-in-one CRM and marketing platform', 'oauth2', 'https://marketplace.gohighlevel.com/oauth/chooselocation', 'https://services.leadconnectorhq.com/oauth/token', ARRAY['contacts.readonly', 'opportunities.readonly'], '[{"step": 1, "title": "Create Marketplace App", "description": "Register at marketplace.gohighlevel.com"}]'::jsonb, '[]'::jsonb, 'https://services.leadconnectorhq.com/contacts/', 'https://highlevel.stoplight.io/docs', 18);

-- ═══ SEED DATA: Service Relationships ═══

INSERT INTO public.service_relationships (source_service, target_service, relationship_type, priority, reason) VALUES
-- Google ecosystem
('google_analytics', 'google_ads', 'recommends', 90, 'Track ad performance and conversions together'),
('google_analytics', 'google_calendar', 'enhances', 40, 'Schedule reports based on calendar events'),
('google_ads', 'google_analytics', 'requires', 95, 'Need Analytics for conversion tracking'),

-- Marketing stack
('meta_ads', 'google_analytics', 'recommends', 85, 'Unified cross-channel attribution'),
('meta_ads', 'stripe', 'enhances', 70, 'Track ad-to-purchase funnel'),

-- Finance stack
('stripe', 'quickbooks', 'recommends', 90, 'Auto-sync payments to bookkeeping'),
('stripe', 'plaid', 'enhances', 60, 'Bank verification for ACH payments'),
('quickbooks', 'plaid', 'recommends', 85, 'Automatic bank transaction import'),

-- Communication stack
('twilio', 'vapi', 'enhances', 80, 'Use Twilio numbers with Vapi voice agents'),
('resend', 'stripe', 'recommends', 75, 'Send payment receipts and invoices'),

-- Video production stack
('elevenlabs', 'did', 'recommends', 85, 'Use ElevenLabs voices with D-ID avatars'),
('elevenlabs', 'heygen', 'recommends', 85, 'Use ElevenLabs voices with HeyGen avatars'),
('did', 'heygen', 'replaces', 50, 'Alternative video avatar platforms'),

-- Ecommerce stack
('shopify', 'stripe', 'recommends', 90, 'Unified payment processing'),
('shopify', 'google_analytics', 'recommends', 85, 'Track ecommerce conversions'),
('shopify', 'meta_ads', 'recommends', 80, 'Run retargeting campaigns'),

-- HVAC business stack
('vapi', 'twilio', 'requires', 95, 'Need phone numbers for voice agents'),
('vapi', 'ghl', 'recommends', 90, 'Sync call data to CRM'),
('stripe', 'vapi', 'enhances', 70, 'Accept payments over voice');

-- ═══ SEED DATA: Integration Templates ═══

INSERT INTO public.integration_templates (template_key, display_name, description, icon_emoji, recommended_services, required_services, setup_order) VALUES
('hvac_basic', 'HVAC Business - Essential', 'Core integrations for HVAC service businesses', '🔧', ARRAY['vapi', 'twilio', 'stripe', 'ghl', 'google_analytics'], ARRAY['vapi', 'stripe'], ARRAY['stripe', 'twilio', 'vapi', 'ghl', 'google_analytics']),

('hvac_advanced', 'HVAC Business - Advanced', 'Complete automation for high-growth HVAC companies', '🏆', ARRAY['vapi', 'twilio', 'stripe', 'ghl', 'google_analytics', 'google_ads', 'quickbooks', 'resend', 'elevenlabs'], ARRAY['vapi', 'stripe', 'twilio'], ARRAY['stripe', 'twilio', 'vapi', 'resend', 'ghl', 'google_analytics', 'google_ads', 'quickbooks', 'elevenlabs']),

('ecommerce_starter', 'Ecommerce - Starter', 'Essential integrations for online stores', '🛍️', ARRAY['shopify', 'stripe', 'google_analytics', 'meta_ads'], ARRAY['shopify', 'stripe'], ARRAY['stripe', 'shopify', 'google_analytics', 'meta_ads']),

('agency_growth', 'Agency - Growth', 'Tools for marketing and creative agencies', '🎯', ARRAY['stripe', 'google_analytics', 'google_ads', 'meta_ads', 'resend', 'ghl', 'elevenlabs', 'did'], ARRAY['stripe'], ARRAY['stripe', 'resend', 'ghl', 'google_analytics', 'google_ads', 'meta_ads', 'elevenlabs', 'did']),

('consulting_pro', 'Consulting - Professional', 'Integrations for B2B consulting firms', '💼', ARRAY['stripe', 'google_calendar', 'resend', 'quickbooks', 'vapi'], ARRAY['stripe'], ARRAY['stripe', 'google_calendar', 'resend', 'quickbooks', 'vapi']);

-- ═══ SEED DATA: Agent Permissions ═══

INSERT INTO public.agent_integration_permissions (agent_name, display_name, description, required_services, allowed_services, allowed_actions, max_daily_api_calls, max_cost_per_day_cents) VALUES
('ceo-agent', 'CEO Strategic Advisor', 'Full access to all integrations for strategic analysis', ARRAY[]::TEXT[], ARRAY['*'], '{"*": ["read", "analyze", "test", "configure"]}'::jsonb, 10000, 2000),

('marketing-agent', 'Marketing Automation Agent', 'Manages advertising and analytics integrations', ARRAY['google_analytics'], ARRAY['google_analytics', 'google_ads', 'meta_ads', 'resend'], '{"google_analytics": ["read"], "google_ads": ["read", "create", "update"], "meta_ads": ["read", "create", "update"], "resend": ["send"]}'::jsonb, 5000, 1000),

('finance-agent', 'Finance & Billing Agent', 'Handles payments and accounting integrations', ARRAY['stripe'], ARRAY['stripe', 'quickbooks', 'plaid'], '{"stripe": ["read", "create_invoice", "refund"], "quickbooks": ["read", "sync"], "plaid": ["read"]}'::jsonb, 2000, 500),

('content-agent', 'Content Production Agent', 'Creates video and audio content', ARRAY[]::TEXT[], ARRAY['elevenlabs', 'did', 'heygen'], '{"elevenlabs": ["read", "generate"], "did": ["read", "generate"], "heygen": ["read", "generate"]}'::jsonb, 500, 5000),

('communication-agent', 'Communication Agent', 'Handles SMS, calls, and email', ARRAY['twilio'], ARRAY['twilio', 'resend', 'vapi'], '{"twilio": ["read", "send_sms", "call"], "resend": ["send"], "vapi": ["read", "create_call"]}'::jsonb, 3000, 800),

('infrastructure-agent', 'Infrastructure Agent', 'System health and monitoring', ARRAY[]::TEXT[], ARRAY['*'], '{"*": ["test", "health_check"]}'::jsonb, 1000, 100);

-- ═══ TRIGGERS ═══

-- Auto-update timestamps
CREATE TRIGGER update_service_credentials_updated_at
BEFORE UPDATE ON public.service_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_registry_updated_at
BEFORE UPDATE ON public.service_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_integration_permissions_updated_at
BEFORE UPDATE ON public.agent_integration_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();