-- ============================================================
-- Federação Rebug — Elenco por Campeonato (squad por time em cada copa)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Problema: o elenco de um time (team_players) é GLOBAL/histórico e muda entre
-- edições. Usá-lo em copas antigas polui o histórico (mostra o elenco atual).
--
-- Solução: pivô (copa + time + jogador) marcando quem jogou AQUELA edição.
--   - position: posição do jogador NAQUELA copa (override; cai na global se nulo)
--   - Um jogador entra no máximo uma vez por (copa, time).
--
-- Onde vale:
--   - fallback de escalação na página da copa (jogos sem escalação registrada
--     passam a usar este elenco, não o elenco global atual);
--   - exibição do elenco daquela edição.
-- A aba Times (global) continua usando team_players, sem mudança.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

create table if not exists public.tournament_team_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  team_id       uuid not null references public.teams(id)       on delete cascade,
  player_id     uuid not null references public.players(id)     on delete cascade,
  position      text check (position in ('GK', 'ZAG', 'MID', 'ATK')),
  primary key (tournament_id, team_id, player_id)
);

alter table public.tournament_team_players enable row level security;

drop policy if exists "tournament_team_players_read" on public.tournament_team_players;
create policy "tournament_team_players_read" on public.tournament_team_players
  for select using (true);

drop policy if exists "tournament_team_players_write" on public.tournament_team_players;
create policy "tournament_team_players_write" on public.tournament_team_players
  for all using (public.is_admin()) with check (public.is_admin());
