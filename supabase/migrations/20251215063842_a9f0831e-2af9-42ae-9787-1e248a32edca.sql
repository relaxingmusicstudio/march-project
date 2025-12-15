-- Create follow_up_tasks table for AI-collected human request follow-ups
CREATE TABLE public.follow_up_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_log_id UUID REFERENCES public.call_logs(id),
  lead_id UUID REFERENCES public.leads(id),
  contact_id UUID REFERENCES public.contacts_unified(id),
  
  -- Message collection data
  topic TEXT NOT NULL,
  contact_preference TEXT NOT NULL DEFAULT 'call', -- 'call', 'email', 'sms'
  timeline_expectation TEXT, -- e.g., "end of day tomorrow"
  caller_phone TEXT,
  caller_email TEXT,
  
  -- AI-generated drafts
  ai_draft_email JSONB, -- { subject, body, generated_at }
  ai_draft_script TEXT,
  ai_draft_sms TEXT,
  
  -- Task status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  priority TEXT NOT NULL DEFAULT 'high', -- low, medium, high, urgent
  assigned_to UUID,
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reply_sent_at TIMESTAMP WITH TIME ZONE,
  reply_method TEXT, -- how the user actually replied
  reply_content TEXT, -- what was sent
  
  -- CRM integration
  crm_logged_at TIMESTAMP WITH TIME ZONE,
  crm_activity_id TEXT
);

-- Add columns to call_logs for human request tracking
ALTER TABLE public.call_logs 
ADD COLUMN IF NOT EXISTS human_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS message_collected JSONB,
ADD COLUMN IF NOT EXISTS follow_up_task_id UUID REFERENCES public.follow_up_tasks(id);

-- Enable RLS
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage follow_up_tasks" 
ON public.follow_up_tasks FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert follow_up_tasks" 
ON public.follow_up_tasks FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update follow_up_tasks" 
ON public.follow_up_tasks FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can view follow_up_tasks" 
ON public.follow_up_tasks FOR SELECT 
USING (true);

-- Indexes for performance
CREATE INDEX idx_follow_up_tasks_status ON public.follow_up_tasks(status);
CREATE INDEX idx_follow_up_tasks_lead_id ON public.follow_up_tasks(lead_id);
CREATE INDEX idx_follow_up_tasks_created_at ON public.follow_up_tasks(created_at DESC);
CREATE INDEX idx_call_logs_human_requested ON public.call_logs(human_requested) WHERE human_requested = true;

-- Trigger for updated_at
CREATE TRIGGER update_follow_up_tasks_updated_at
BEFORE UPDATE ON public.follow_up_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();