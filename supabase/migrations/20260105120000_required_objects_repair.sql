-- Required objects repair (idempotent)

-- app_role type
DO $$
BEGIN
  IF to_regtype('public.app_role') IS NULL THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
  END IF;
END $$;

-- has_role(role text, user_id uuid) RPC
DO $$
BEGIN
  IF to_regprocedure('public.has_role(text, uuid)') IS NULL THEN
    EXECUTE $sql$
      create or replace function public.has_role(
        role text,
        user_id uuid default auth.uid()
      )
      returns boolean
      language plpgsql
      stable
      security definer
      set search_path = public, auth
      as $fn$
      declare
        claims jsonb;
        appmeta jsonb;
      begin
        if user_id is null then
          return false;
        end if;

        claims := coalesce(auth.jwt(), '{}'::jsonb);
        appmeta := coalesce(claims->'app_metadata', '{}'::jsonb);

        if jsonb_typeof(appmeta->'roles') = 'array' then
          return (appmeta->'roles') ? role;
        end if;

        if (appmeta ? 'role') then
          return (appmeta->>'role') = role;
        end if;

        select coalesce(u.raw_app_meta_data, '{}'::jsonb)
        into appmeta
        from auth.users u
        where u.id = user_id;

        if jsonb_typeof(appmeta->'roles') = 'array' then
          return (appmeta->'roles') ? role;
        end if;

        return coalesce(appmeta->>'role','') = role;
      end;
      $fn$;
    $sql$;
  END IF;

  IF to_regprocedure('public.has_role(text, uuid)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(text, uuid) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.has_role(text, uuid) TO anon';
  END IF;
END $$;

-- db_to_regtype helper
DO $$
BEGIN
  IF to_regprocedure('public.db_to_regtype(text)') IS NULL THEN
    EXECUTE $sql$
      create or replace function public.db_to_regtype(p_name text)
      returns text
      language sql
      stable
      security definer
      set search_path = public, pg_catalog
      as $fn$
        select pg_catalog.to_regtype(p_name)::text;
      $fn$;
    $sql$;
  END IF;

  IF to_regprocedure('public.db_to_regtype(text)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.db_to_regtype(text) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.db_to_regtype(text) TO anon';
  END IF;
END $$;

-- db_to_regprocedure helper
DO $$
BEGIN
  IF to_regprocedure('public.db_to_regprocedure(text)') IS NULL THEN
    EXECUTE $sql$
      create or replace function public.db_to_regprocedure(p_name text)
      returns text
      language sql
      stable
      security definer
      set search_path = public, pg_catalog
      as $fn$
        select pg_catalog.to_regprocedure(p_name)::text;
      $fn$;
    $sql$;
  END IF;

  IF to_regprocedure('public.db_to_regprocedure(text)') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.db_to_regprocedure(text) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.db_to_regprocedure(text) TO anon';
  END IF;
END $$;

-- visitors table
CREATE TABLE IF NOT EXISTS public.visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT UNIQUE NOT NULL,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_visits INTEGER DEFAULT 1,
  device TEXT,
  browser TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_page TEXT,
  referrer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.visitors
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS total_visits INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS device TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_visitors_visitor_id ON public.visitors(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_created_at ON public.visitors(created_at);

-- action_logs table
CREATE TABLE IF NOT EXISTS public.action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  mode text not null,
  intent text not null,
  status text not null,
  payload jsonb,
  proof jsonb
);

ALTER TABLE IF EXISTS public.action_logs
  ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete set null,
  ADD COLUMN IF NOT EXISTS created_at timestamptz not null default now(),
  ADD COLUMN IF NOT EXISTS mode text,
  ADD COLUMN IF NOT EXISTS intent text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS payload jsonb,
  ADD COLUMN IF NOT EXISTS proof jsonb;

CREATE INDEX IF NOT EXISTS action_logs_user_idx ON public.action_logs(user_id);
CREATE INDEX IF NOT EXISTS action_logs_created_at_idx ON public.action_logs(created_at desc);

-- ceo_conversations table
CREATE TABLE IF NOT EXISTS public.ceo_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  tenant_id uuid,
  title text default 'Business Strategy Session',
  messages jsonb default '[]'::jsonb,
  context jsonb default '{}'::jsonb,
  is_active boolean default true,
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

ALTER TABLE IF EXISTS public.ceo_conversations
  ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade,
  ADD COLUMN IF NOT EXISTS tenant_id uuid,
  ADD COLUMN IF NOT EXISTS title text default 'Business Strategy Session',
  ADD COLUMN IF NOT EXISTS messages jsonb default '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS context jsonb default '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_active boolean default true,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz default now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz default now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz default now();

CREATE UNIQUE INDEX IF NOT EXISTS ceo_conversations_active_idx
  ON public.ceo_conversations(user_id, tenant_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS ceo_conversations_user_idx ON public.ceo_conversations(user_id);
CREATE INDEX IF NOT EXISTS ceo_conversations_tenant_idx ON public.ceo_conversations(tenant_id);

-- onboarding_state table
CREATE TABLE IF NOT EXISTS public.onboarding_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  industry TEXT,
  service_area TEXT,
  primary_goal TEXT,
  offer_pricing TEXT,
  target_customer TEXT,
  lead_sources TEXT,
  calendar_link TEXT,
  contact_phone TEXT,
  step_completed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.onboarding_state
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS service_area TEXT,
  ADD COLUMN IF NOT EXISTS primary_goal TEXT,
  ADD COLUMN IF NOT EXISTS offer_pricing TEXT,
  ADD COLUMN IF NOT EXISTS target_customer TEXT,
  ADD COLUMN IF NOT EXISTS lead_sources TEXT,
  ADD COLUMN IF NOT EXISTS calendar_link TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS step_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
