-- ============================================================
-- Federação Rebug — Times & Torneios
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql já ter sido rodado: usa players + is_admin())
-- ============================================================

-- ---------- TIMES ----------
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  titles      int  not null default 0,   -- Títulos
  runner_ups  int  not null default 0,   -- Vices
  wins        int  not null default 0,   -- Vitórias
  losses      int  not null default 0,   -- Derrotas
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Elenco: N:N entre times e jogadores
create table if not exists public.team_players (
  team_id   uuid not null references public.teams(id)   on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  primary key (team_id, player_id)
);

-- ---------- TORNEIOS ----------
create table if not exists public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'Em andamento', -- Em andamento | Finalizado | Em breve
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Times participantes (N:N)
create table if not exists public.tournament_teams (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id       uuid not null references public.teams(id)       on delete cascade,
  primary key (tournament_id, team_id)
);

-- Jogadores vinculados (N:N)
create table if not exists public.tournament_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id     uuid not null references public.players(id)     on delete cascade,
  primary key (tournament_id, player_id)
);

-- Súmulas (partidas estruturadas)
create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  home_team_id  uuid references public.teams(id) on delete set null,
  away_team_id  uuid references public.teams(id) on delete set null,
  home_score    int  not null default 0,
  away_score    int  not null default 0,
  played_at     date,
  notes         text,
  created_at    timestamptz not null default now()
);

-- Gols por jogador em cada partida (base da artilharia automática)
create table if not exists public.match_goals (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches(id)   on delete cascade,
  player_id uuid not null references public.players(id)   on delete cascade,
  goals     int  not null default 1
);

-- Mensagens / avisos do campeonato
create table if not exists public.tournament_messages (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  body          text not null,
  created_at    timestamptz not null default now()
);

-- ---------- ARTILHARIA AUTOMÁTICA (view) ----------
create or replace view public.tournament_top_scorers as
  select m.tournament_id,
         g.player_id,
         p.name as player_name,
         sum(g.goals)::int as goals
  from public.match_goals g
  join public.matches m on m.id = g.match_id
  join public.players p on p.id = g.player_id
  group by m.tournament_id, g.player_id, p.name;

grant select on public.tournament_top_scorers to anon, authenticated;

-- ---------- RLS: todos leem, só admin escreve ----------
do $$
declare t text;
begin
  foreach t in array array[
    'teams','team_players','tournaments','tournament_teams',
    'tournament_players','matches','match_goals','tournament_messages'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "%s_read" on public.%I;', t, t);
    execute format('create policy "%s_read" on public.%I for select using (true);', t, t);
    execute format('drop policy if exists "%s_write" on public.%I;', t, t);
    execute format(
      'create policy "%s_write" on public.%I for all using (public.is_admin()) with check (public.is_admin());',
      t, t
    );
  end loop;
end $$;

-- updated_at automático (reusa a função criada em schema.sql)
drop trigger if exists teams_touch on public.teams;
create trigger teams_touch before update on public.teams
  for each row execute function public.touch_updated_at();

drop trigger if exists tournaments_touch on public.tournaments;
create trigger tournaments_touch before update on public.tournaments
  for each row execute function public.touch_updated_at();
