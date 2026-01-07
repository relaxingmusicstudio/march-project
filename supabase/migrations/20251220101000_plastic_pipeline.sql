-- Plastic Surgeon Lead Engine schema

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  clinic text,
  city text,
  phone text,
  email text,
  ig_handle text,
  notes text,
  status text not null default 'lead_source' check (status in (
    'lead_source','enrichment','outreach','qualification','booked','showed','won','lost'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.leads
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create or replace function public.update_leads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.update_leads_updated_at();

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table if exists public.lead_events
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create table if not exists public.consults (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  consult_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','showed','no_show','rescheduled','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.consults
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create or replace function public.update_consults_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_consults_updated_at on public.consults;
create trigger trg_consults_updated_at
before update on public.consults
for each row execute function public.update_consults_updated_at();

alter table public.leads enable row level security;
alter table public.lead_events enable row level security;
alter table public.consults enable row level security;

drop policy if exists "leads_select_own" on public.leads;
create policy "leads_select_own" on public.leads for select using (auth.uid() = user_id);
drop policy if exists "leads_insert_own" on public.leads;
create policy "leads_insert_own" on public.leads for insert with check (auth.uid() = user_id);
drop policy if exists "leads_update_own" on public.leads;
create policy "leads_update_own" on public.leads for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "leads_delete_own" on public.leads;
create policy "leads_delete_own" on public.leads for delete using (auth.uid() = user_id);

drop policy if exists "lead_events_select_own" on public.lead_events;
create policy "lead_events_select_own" on public.lead_events for select using (auth.uid() = user_id);
drop policy if exists "lead_events_insert_own" on public.lead_events;
create policy "lead_events_insert_own" on public.lead_events for insert with check (auth.uid() = user_id);
drop policy if exists "lead_events_update_own" on public.lead_events;
create policy "lead_events_update_own" on public.lead_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "lead_events_delete_own" on public.lead_events;
create policy "lead_events_delete_own" on public.lead_events for delete using (auth.uid() = user_id);

drop policy if exists "consults_select_own" on public.consults;
create policy "consults_select_own" on public.consults for select using (auth.uid() = user_id);
drop policy if exists "consults_insert_own" on public.consults;
create policy "consults_insert_own" on public.consults for insert with check (auth.uid() = user_id);
drop policy if exists "consults_update_own" on public.consults;
create policy "consults_update_own" on public.consults for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "consults_delete_own" on public.consults;
create policy "consults_delete_own" on public.consults for delete using (auth.uid() = user_id);
