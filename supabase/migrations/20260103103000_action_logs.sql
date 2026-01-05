-- v17.2 CEO action proof logging
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

alter table public.action_logs enable row level security;

create policy "Users can insert own action logs" on public.action_logs
  for insert with check (auth.uid() = user_id);

create policy "Users can view own action logs" on public.action_logs
  for select using (auth.uid() = user_id);
