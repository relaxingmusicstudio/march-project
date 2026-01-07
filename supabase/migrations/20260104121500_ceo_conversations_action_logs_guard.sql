-- Guard migration to ensure required SIM tables exist and are accessible.

-- ceo_conversations (used by CEO chat panel)
create table if not exists public.ceo_conversations (
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

alter table public.ceo_conversations add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.ceo_conversations add column if not exists tenant_id uuid;
alter table public.ceo_conversations add column if not exists title text default 'Business Strategy Session';
alter table public.ceo_conversations add column if not exists messages jsonb default '[]'::jsonb;
alter table public.ceo_conversations add column if not exists context jsonb default '{}'::jsonb;
alter table public.ceo_conversations add column if not exists is_active boolean default true;
alter table public.ceo_conversations add column if not exists last_message_at timestamptz default now();
alter table public.ceo_conversations add column if not exists created_at timestamptz default now();
alter table public.ceo_conversations add column if not exists updated_at timestamptz default now();

do $$
begin
  if to_regclass('public.tenants') is not null then
    if not exists (
      select 1 from pg_constraint where conname = 'ceo_conversations_tenant_id_fkey'
    ) then
      alter table public.ceo_conversations
        add constraint ceo_conversations_tenant_id_fkey
        foreign key (tenant_id) references public.tenants(id) on delete cascade;
    end if;
  end if;
end $$;

create unique index if not exists ceo_conversations_active_idx
  on public.ceo_conversations(user_id, tenant_id) where is_active = true;
create index if not exists ceo_conversations_user_idx on public.ceo_conversations(user_id);
create index if not exists ceo_conversations_tenant_idx on public.ceo_conversations(tenant_id);

alter table public.ceo_conversations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ceo_conversations'
      and policyname = 'ceo_conversations_select_own'
  ) then
    create policy "ceo_conversations_select_own" on public.ceo_conversations
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ceo_conversations'
      and policyname = 'ceo_conversations_insert_own'
  ) then
    create policy "ceo_conversations_insert_own" on public.ceo_conversations
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'ceo_conversations'
      and policyname = 'ceo_conversations_update_own'
  ) then
    create policy "ceo_conversations_update_own" on public.ceo_conversations
      for update using (auth.uid() = user_id);
  end if;
end $$;

-- action_logs (used by proof spine + debug panel)
create table if not exists public.action_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  mode text not null,
  intent text not null,
  status text not null,
  payload jsonb,
  proof jsonb
);

alter table public.action_logs add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.action_logs add column if not exists created_at timestamptz not null default now();
alter table public.action_logs add column if not exists mode text;
alter table public.action_logs add column if not exists intent text;
alter table public.action_logs add column if not exists status text;
alter table public.action_logs add column if not exists payload jsonb;
alter table public.action_logs add column if not exists proof jsonb;

create index if not exists action_logs_user_idx on public.action_logs(user_id);
create index if not exists action_logs_created_at_idx on public.action_logs(created_at desc);

alter table public.action_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'action_logs'
      and policyname = 'action_logs_select_own'
  ) then
    create policy "action_logs_select_own" on public.action_logs
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'action_logs'
      and policyname = 'action_logs_insert_own'
  ) then
    create policy "action_logs_insert_own" on public.action_logs
      for insert with check (auth.uid() = user_id);
  end if;
end $$;
