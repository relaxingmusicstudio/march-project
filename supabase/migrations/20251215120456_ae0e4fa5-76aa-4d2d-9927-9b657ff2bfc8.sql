-- CEO Style Profile table - stores learned preferences and style patterns
CREATE TABLE public.ceo_style_profile (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL, -- 'communication', 'decisions', 'priorities', 'thresholds'
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric DEFAULT 0.5,
  learned_from_count integer DEFAULT 0,
  examples jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(category, key)
);

-- CEO Decision Feedback table - tracks approved/rejected suggestions for learning
CREATE TABLE public.ceo_decision_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_queue_id uuid REFERENCES public.ceo_action_queue(id),
  original_suggestion text NOT NULL,
  ceo_response text, -- what CEO actually said/did
  feedback_type text NOT NULL, -- 'approved', 'rejected', 'modified'
  modification_notes text,
  style_learnings jsonb DEFAULT '{}'::jsonb, -- extracted style insights
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- CEO Draft History - tracks AI drafts and CEO edits for style learning
CREATE TABLE public.ceo_draft_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_type text NOT NULL, -- 'email', 'response', 'content', 'decision'
  context jsonb DEFAULT '{}'::jsonb,
  ai_draft text NOT NULL,
  ceo_final text, -- what CEO actually used
  similarity_score numeric, -- how close was AI to CEO style
  style_adjustments jsonb DEFAULT '[]'::jsonb, -- what changed
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ceo_style_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_decision_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_draft_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage ceo_style_profile" ON public.ceo_style_profile FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view ceo_style_profile" ON public.ceo_style_profile FOR SELECT USING (true);
CREATE POLICY "Service role full access ceo_style_profile" ON public.ceo_style_profile FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage ceo_decision_feedback" ON public.ceo_decision_feedback FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view ceo_decision_feedback" ON public.ceo_decision_feedback FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ceo_decision_feedback" ON public.ceo_decision_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role full access ceo_decision_feedback" ON public.ceo_decision_feedback FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admins can manage ceo_draft_history" ON public.ceo_draft_history FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view ceo_draft_history" ON public.ceo_draft_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert ceo_draft_history" ON public.ceo_draft_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role full access ceo_draft_history" ON public.ceo_draft_history FOR ALL USING (true) WITH CHECK (true);

-- Insert default CEO style profile entries
INSERT INTO public.ceo_style_profile (category, key, value, confidence_score) VALUES
  ('communication', 'tone', '{"primary": "professional", "secondary": "friendly", "avoid": ["overly formal", "jargon"]}', 0.3),
  ('communication', 'response_length', '{"preference": "concise", "max_sentences": 3, "use_bullets": true}', 0.3),
  ('decisions', 'risk_tolerance', '{"level": "moderate", "threshold_usd": 500, "auto_approve_under": 100}', 0.3),
  ('decisions', 'speed_vs_quality', '{"preference": "speed", "acceptable_quality_min": 80}', 0.3),
  ('priorities', 'lead_response_time', '{"hot_leads_max_minutes": 5, "warm_leads_max_hours": 2}', 0.3),
  ('priorities', 'revenue_vs_relationships', '{"balance": "relationships_first", "min_margin_percent": 20}', 0.3),
  ('thresholds', 'auto_approve', '{"content_types": ["social_posts", "follow_up_emails"], "max_value_usd": 100}', 0.3),
  ('thresholds', 'require_review', '{"content_types": ["pricing", "contracts", "refunds"], "always": true}', 0.3);

-- Update trigger for style profile
CREATE TRIGGER update_ceo_style_profile_updated_at
  BEFORE UPDATE ON public.ceo_style_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();