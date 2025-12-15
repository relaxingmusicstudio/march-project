-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Agent Memories table - stores successful interactions with embeddings
CREATE TABLE public.agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  query TEXT NOT NULL,
  query_embedding vector(1536),
  response TEXT NOT NULL,
  success_score NUMERIC DEFAULT 0.5,
  usage_count INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Learning Events table - audit trail for learning
CREATE TABLE public.learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID REFERENCES public.agent_memories(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'positive_feedback', 'negative_feedback', 'correction', 'usage'
  feedback_value INTEGER, -- 1-5 rating or thumbs (1=down, 5=up)
  feedback_source TEXT, -- 'user', 'system', 'auto'
  old_score NUMERIC,
  new_score NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agent Performance table - tracks agent improvement over time
CREATE TABLE public.agent_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_queries INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  positive_feedback INTEGER DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  avg_response_time_ms INTEGER,
  accuracy_score NUMERIC DEFAULT 0.5,
  memories_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_type, date)
);

-- Enable RLS
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_performance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_memories
CREATE POLICY "Admins can manage agent memories"
  ON public.agent_memories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert agent memories"
  ON public.agent_memories FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view agent memories"
  ON public.agent_memories FOR SELECT
  USING (true);

CREATE POLICY "Anyone can update agent memories"
  ON public.agent_memories FOR UPDATE
  USING (true);

-- RLS Policies for learning_events
CREATE POLICY "Admins can manage learning events"
  ON public.learning_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert learning events"
  ON public.learning_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view learning events"
  ON public.learning_events FOR SELECT
  USING (true);

-- RLS Policies for agent_performance
CREATE POLICY "Admins can manage agent performance"
  ON public.agent_performance FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can insert agent performance"
  ON public.agent_performance FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update agent performance"
  ON public.agent_performance FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can view agent performance"
  ON public.agent_performance FOR SELECT
  USING (true);

-- Create indexes for similarity search
CREATE INDEX idx_agent_memories_embedding ON public.agent_memories 
  USING ivfflat (query_embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_agent_memories_agent_type ON public.agent_memories(agent_type);
CREATE INDEX idx_agent_memories_success_score ON public.agent_memories(success_score DESC);
CREATE INDEX idx_learning_events_memory_id ON public.learning_events(memory_id);
CREATE INDEX idx_agent_performance_agent_date ON public.agent_performance(agent_type, date DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_agent_memories_updated_at
  BEFORE UPDATE ON public.agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_performance_updated_at
  BEFORE UPDATE ON public.agent_performance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();