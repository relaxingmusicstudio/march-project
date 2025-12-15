-- Create user_directives table for human-in-the-loop tracking
CREATE TABLE public.user_directives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'ceo_hub', 'voice', 'chat', 'crm', 'settings', 'contact_form'
  input_type TEXT DEFAULT 'text', -- 'text', 'voice', 'command', 'form'
  content TEXT NOT NULL,
  intent TEXT, -- AI-classified: 'approval', 'pause', 'priority_change', 'question', 'feedback', 'directive'
  action_required BOOLEAN DEFAULT false,
  action_taken BOOLEAN DEFAULT false,
  handled_by TEXT, -- Which agent/user handled it
  related_entity_type TEXT, -- 'lead', 'client', 'content', 'invoice', 'campaign'
  related_entity_id UUID,
  priority TEXT DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient agent queries
CREATE INDEX idx_user_directives_pending ON public.user_directives(action_required, action_taken) WHERE action_required = true AND action_taken = false;
CREATE INDEX idx_user_directives_source ON public.user_directives(source);
CREATE INDEX idx_user_directives_created ON public.user_directives(created_at DESC);
CREATE INDEX idx_user_directives_intent ON public.user_directives(intent) WHERE intent IS NOT NULL;
CREATE INDEX idx_user_directives_entity ON public.user_directives(related_entity_type, related_entity_id) WHERE related_entity_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.user_directives ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all directives" ON public.user_directives
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert directives" ON public.user_directives
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view directives" ON public.user_directives
  FOR SELECT USING (true);

CREATE POLICY "Anyone can update directives" ON public.user_directives
  FOR UPDATE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_user_directives_updated_at
  BEFORE UPDATE ON public.user_directives
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();