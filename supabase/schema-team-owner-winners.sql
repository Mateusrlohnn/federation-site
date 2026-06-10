-- ============================================================
-- Federação Rebug — Dono do time + Jogadores campeões/vices por copa
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql / schema.sql)
--
-- 1) teams.owner_id  : "dono" do time (um jogador). Ajuda a organizar e
--    diferenciar times de mesmo nome (donos diferentes).
-- 2) tournament_winner_players : marca, POR COPA, quais jogadores foram
--    campeões / vice-campeões (o elenco vencedor daquela edição). Evita
--    duplicar o time ou marcar todo o histórico do elenco como campeão.
--      kind = 'champion'  -> jogador campeão daquela copa
--      kind = 'runner_up' -> jogador vice-campeão daquela copa
--    Um jogador entra no máximo uma vez por copa (PK).
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- 1) Dono do time -------------------------------------------------------------
alter table public.teams
  add column if not exists owner_id uuid references public.players(id) on delete set null;

-- 2) Jogadores campeões/vices por copa ---------------------------------------
create table if not exists public.tournament_winner_players (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id     uuid not null references public.players(id)     on delete cascade,
  kind          text not null check (kind in ('champion', 'runner_up')),
  primary key (tournament_id, player_id)
);

alter table public.tournament_winner_players enable row level security;

drop policy if exists "tournament_winner_players_read" on public.tournament_winner_players;
create policy "tournament_winner_players_read" on public.tournament_winner_players
  for select using (true);

drop policy if exists "tournament_winner_players_write" on public.tournament_winner_players;
create policy "tournament_winner_players_write" on public.tournament_winner_players
  for all using (public.is_admin()) with check (public.is_admin());
