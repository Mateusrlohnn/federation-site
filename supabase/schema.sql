-- ============================================================
-- Federação Rebug — database schema
-- Run this in Supabase: Dashboard > SQL Editor > New query > paste > Run
-- ============================================================

-- 1) PLAYERS (Hall of Fame) ----------------------------------
create table if not exists public.players (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null unique,
  position            text check (position in ('GK', 'ZAG', 'MID', 'ATK')), -- posição natural (opcional)
  titles              int  not null default 0,
  runner_ups          int  not null default 0,  -- Vices
  mvp                 int  not null default 0,
  top1                int  not null default 0,
  top2                int  not null default 0,
  top3                int  not null default 0,
  titles_academy      int  not null default 0,
  mvp_academy         int  not null default 0,  -- MVP.A
  runner_ups_academy  int  not null default 0,  -- Vices Academy
  t1_academy          int  not null default 0,
  t2_academy          int  not null default 0,
  t3_academy          int  not null default 0,
  -- points are computed automatically from the scoring weights
  points int generated always as (
    titles*100 + runner_ups*30 + mvp*50 + top1*40 + top2*20 + top3*10 +
    titles_academy*10 + mvp_academy*8 + runner_ups_academy*5 +
    t1_academy*7 + t2_academy*3 + t3_academy*1
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) ADMINS (allowlist of e-mails that can edit) -------------
create table if not exists public.admins (
  email text primary key
);

-- helper: is the current logged-in user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins a
    where a.email = (auth.jwt() ->> 'email')
  );
$$;

-- 3) ROW LEVEL SECURITY --------------------------------------
alter table public.players enable row level security;
alter table public.admins  enable row level security;

-- everyone (even anonymous) can READ players
drop policy if exists "players_public_read" on public.players;
create policy "players_public_read"
  on public.players for select
  using (true);

-- only admins can INSERT / UPDATE / DELETE players
drop policy if exists "players_admin_write" on public.players;
create policy "players_admin_write"
  on public.players for all
  using (public.is_admin())
  with check (public.is_admin());

-- admins table: only admins can read it (function bypasses via security definer)
drop policy if exists "admins_admin_read" on public.admins;
create policy "admins_admin_read"
  on public.admins for select
  using (public.is_admin());

-- 4) keep updated_at fresh -----------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists players_touch_updated_at on public.players;
create trigger players_touch_updated_at
  before update on public.players
  for each row execute function public.touch_updated_at();

-- 5) SEED ADMINS — EDIT THESE E-MAILS ------------------------
-- (use the same e-mail you create under Authentication > Users)
insert into public.admins (email) values
  ('levi@example.com')
on conflict (email) do nothing;
