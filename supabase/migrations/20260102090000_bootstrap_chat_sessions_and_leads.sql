-- Bootstrap chat sessions/messages and extend leads for alex-chat.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS session_id UUID;

ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS text TEXT;

ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS ts TIMESTAMPTZ;

DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    UPDATE public.chat_messages
    SET text = COALESCE(text, content),
        ts = COALESCE(ts, created_at)
    WHERE text IS NULL OR ts IS NULL;

    ALTER TABLE public.chat_messages ALTER COLUMN text SET NOT NULL;
    ALTER TABLE public.chat_messages ALTER COLUMN ts SET NOT NULL;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS city TEXT;

ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS intent TEXT;

ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS urgency TEXT;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_visitor_id ON public.chat_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_seen_at ON public.chat_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_ts ON public.chat_messages(ts DESC);
