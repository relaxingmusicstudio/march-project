-- API Settings table for storing integration credentials
CREATE TABLE api_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  is_configured BOOLEAN DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  test_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage settings" ON api_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Content ideas from trending research
CREATE TABLE content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT,
  source_url TEXT,
  source_transcript TEXT,
  topic TEXT,
  niche TEXT,
  viral_score INTEGER,
  suggested_formats TEXT[],
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage content ideas" ON content_ideas
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Generated content
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id UUID REFERENCES content_ideas,
  content_type TEXT,
  title TEXT,
  body TEXT,
  media_url TEXT,
  platform TEXT,
  status TEXT DEFAULT 'pending',
  user_feedback TEXT,
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  engagement JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage content" ON content
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Content calendar
CREATE TABLE content_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content,
  platform TEXT,
  scheduled_date DATE,
  time_slot TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage calendar" ON content_calendar
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Comments management
CREATE TABLE content_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES content,
  platform TEXT,
  external_comment_id TEXT,
  comment_text TEXT,
  commenter_name TEXT,
  ai_reply TEXT,
  reply_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage comments" ON content_comments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Ad campaigns
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  external_campaign_id TEXT,
  name TEXT,
  objective TEXT,
  budget_daily NUMERIC,
  status TEXT DEFAULT 'draft',
  targeting JSONB,
  performance JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage campaigns" ON ad_campaigns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Keywords research
CREATE TABLE keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  competition TEXT,
  cpc_estimate NUMERIC,
  trend_data JSONB,
  status TEXT DEFAULT 'new',
  current_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage keywords" ON keywords
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));