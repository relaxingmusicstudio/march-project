-- System Modes Configuration
CREATE TABLE public.system_modes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'growth' CHECK (mode IN ('growth', 'maintenance', 'vacation', 'emergency')),
  activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  activated_by TEXT,
  reason TEXT,
  auto_revert_at TIMESTAMP WITH TIME ZONE,
  previous_mode TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Current active mode (only one row needed)
CREATE TABLE public.system_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rules of Engagement
CREATE TABLE public.rules_of_engagement (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('time_restriction', 'budget_limit', 'pipeline_limit', 'approval_required', 'custom')),
  conditions JSONB NOT NULL DEFAULT '{}',
  actions JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Business Context (calendar blocks, focus time, etc.)
CREATE TABLE public.business_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_type TEXT NOT NULL CHECK (context_type IN ('calendar_block', 'business_hours', 'vacation', 'meeting', 'focus_time')),
  title TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_mode TEXT CHECK (auto_mode IN ('growth', 'maintenance', 'vacation', 'emergency')),
  external_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notification Preferences
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  notification_type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'important', 'informative')),
  channels TEXT[] NOT NULL DEFAULT ARRAY['push'],
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Push Notification Queue
CREATE TABLE public.notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'important', 'informative')),
  channels TEXT[] NOT NULL DEFAULT ARRAY['push'],
  data JSONB DEFAULT '{}',
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Human Bypass Requests
CREATE TABLE public.human_bypass_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts_unified(id),
  lead_id UUID REFERENCES public.leads(id),
  channel TEXT NOT NULL,
  trigger_keyword TEXT NOT NULL,
  original_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'resolved', 'expired')),
  assigned_to TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rules_of_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_bypass_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin access)
CREATE POLICY "Authenticated users can read system modes" ON public.system_modes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage system modes" ON public.system_modes FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read system config" ON public.system_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage system config" ON public.system_config FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read ROE" ON public.rules_of_engagement FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage ROE" ON public.rules_of_engagement FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read business context" ON public.business_context FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage business context" ON public.business_context FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own notification prefs" ON public.notification_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can read own notifications" ON public.notification_queue FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notification_queue FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can read bypass requests" ON public.human_bypass_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage bypass requests" ON public.human_bypass_requests FOR ALL USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_system_modes_activated ON public.system_modes(activated_at DESC);
CREATE INDEX idx_roe_active ON public.rules_of_engagement(is_active, priority);
CREATE INDEX idx_business_context_time ON public.business_context(start_time, end_time);
CREATE INDEX idx_notification_queue_pending ON public.notification_queue(status, priority) WHERE status = 'pending';
CREATE INDEX idx_bypass_requests_pending ON public.human_bypass_requests(status, created_at) WHERE status = 'pending';

-- Insert default system config
INSERT INTO public.system_config (config_key, config_value, description) VALUES
('current_mode', '{"mode": "growth", "since": null}', 'Current system operating mode'),
('business_hours', '{"start": "09:00", "end": "18:00", "timezone": "America/New_York", "days": ["monday","tuesday","wednesday","thursday","friday"]}', 'Default business hours'),
('fallback_providers', '{"primary": "lovable", "secondary": "openai", "tertiary": "gemini"}', 'AI provider fallback chain'),
('notification_defaults', '{"critical_channels": ["sms", "push"], "important_channels": ["push"], "informative_channels": ["in_app"]}', 'Default notification routing');

-- Insert default ROE rules
INSERT INTO public.rules_of_engagement (rule_name, rule_type, conditions, actions, priority) VALUES
('No calls before 9 AM', 'time_restriction', '{"before_hour": 9}', '{"block": true, "queue_for_later": true}', 10),
('No calls after 6 PM', 'time_restriction', '{"after_hour": 18}', '{"block": true, "queue_for_later": true}', 10),
('Weekend pause', 'time_restriction', '{"days": ["saturday", "sunday"]}', '{"block": true, "queue_for_monday": true}', 5),
('Daily ad budget limit', 'budget_limit', '{"max_daily_spend": 500, "currency": "USD"}', '{"pause_ads": true, "alert": "critical"}', 1),
('Pipeline overflow pause', 'pipeline_limit', '{"max_active_leads": 100}', '{"pause_outbound": true, "alert": "important"}', 20);

-- Triggers for updated_at
CREATE TRIGGER update_system_modes_updated_at BEFORE UPDATE ON public.system_modes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON public.system_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_roe_updated_at BEFORE UPDATE ON public.rules_of_engagement FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_business_context_updated_at BEFORE UPDATE ON public.business_context FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notification_prefs_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bypass_requests_updated_at BEFORE UPDATE ON public.human_bypass_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();