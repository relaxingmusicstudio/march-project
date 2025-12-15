-- Migration 2: Enhance tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS update_channel text DEFAULT 'stable';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_user_id uuid;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features_enabled jsonb DEFAULT '{"basic_agents": true, "advanced_analytics": false, "custom_integrations": false}'::jsonb;

-- Create hvac_test tenant for development
INSERT INTO tenants (name, slug, subscription_plan, update_channel, settings)
VALUES ('HVAC Test Business', 'hvac_test', 'beta', 'beta', '{"is_demo": true}')
ON CONFLICT (slug) DO NOTHING;