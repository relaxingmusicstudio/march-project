-- Scraped prospects table with intelligent routing
CREATE TABLE public.scraped_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Source & Tracking
  source TEXT NOT NULL, -- 'google_maps', 'fb_ad_comments', 'yelp', 'competitor_audience'
  source_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  
  -- Business Info
  business_name TEXT,
  contact_name TEXT,
  phone TEXT,
  phone_type TEXT, -- 'mobile', 'landline', 'voip', 'unknown'
  email TEXT,
  website TEXT,
  
  -- Location
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  
  -- Business Intelligence
  rating NUMERIC(2,1),
  review_count INTEGER,
  categories TEXT[],
  is_verified BOOLEAN DEFAULT false,
  place_id TEXT UNIQUE,
  
  -- Intent Signals
  pain_signals TEXT[],
  intent_score INTEGER DEFAULT 0,
  competitor_of TEXT,
  
  -- Routing
  outreach_channel TEXT, -- 'sms_mix', 'cold_cold_phone', 'email_first'
  outreach_status TEXT DEFAULT 'new',
  outreach_priority INTEGER DEFAULT 50,
  
  -- Compliance
  consent_status TEXT DEFAULT 'none',
  do_not_contact BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  converted_to_lead_id UUID REFERENCES leads(id)
);

-- SMS keywords for opt-in system
CREATE TABLE public.sms_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT UNIQUE NOT NULL,
  response_message TEXT NOT NULL,
  lead_magnet_url TEXT,
  auto_tag TEXT,
  funnel_id UUID REFERENCES funnels(id),
  is_active BOOLEAN DEFAULT true,
  uses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Competitor monitoring
CREATE TABLE public.competitor_watch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name TEXT NOT NULL,
  competitor_website TEXT,
  competitor_facebook TEXT,
  monitor_type TEXT[],
  is_active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  prospects_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scraped_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_watch ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scraped_prospects
CREATE POLICY "Admins can manage scraped_prospects" ON public.scraped_prospects FOR ALL USING (true);

-- RLS Policies for sms_keywords
CREATE POLICY "Admins can manage sms_keywords" ON public.sms_keywords FOR ALL USING (true);
CREATE POLICY "Anyone can view active keywords" ON public.sms_keywords FOR SELECT USING (is_active = true);

-- RLS Policies for competitor_watch
CREATE POLICY "Admins can manage competitor_watch" ON public.competitor_watch FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_scraped_prospects_source ON public.scraped_prospects(source);
CREATE INDEX idx_scraped_prospects_phone_type ON public.scraped_prospects(phone_type);
CREATE INDEX idx_scraped_prospects_outreach_status ON public.scraped_prospects(outreach_status);
CREATE INDEX idx_scraped_prospects_city_state ON public.scraped_prospects(city, state);
CREATE INDEX idx_sms_keywords_keyword ON public.sms_keywords(keyword);

-- Triggers for updated_at
CREATE TRIGGER update_scraped_prospects_updated_at
  BEFORE UPDATE ON public.scraped_prospects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_keywords_updated_at
  BEFORE UPDATE ON public.sms_keywords
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_competitor_watch_updated_at
  BEFORE UPDATE ON public.competitor_watch
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();