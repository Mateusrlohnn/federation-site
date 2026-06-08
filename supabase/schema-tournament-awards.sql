-- ============================================================
-- Federação Rebug — Pódio / Prêmios da copa
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql / schema.sql)
--
-- Guarda os prêmios atribuídos pelo admin em cada copa (pódio gamificado):
--   award_key:
--     GK_1, GK_2, GK_3, ZAG_1..3, MID_1..3, ATK_1..3  (top por posição)
--     best_player, best_gk, revelation                 (especiais, opcionais)
-- Um jogador por chave. Atribuir = divulgar; chave ausente = "Em breve".
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

create table if not exists public.tournament_awards (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  award_key     text not null,
  player_id     uuid not null references public.players(id) on delete cascade,
  primary key (tournament_id, award_key)
);

alter table public.tournament_awards enable row level security;

drop policy if exists "tournament_awards_read" on public.tournament_awards;
create policy "tournament_awards_read" on public.tournament_awards for select using (true);

drop policy if exists "tournament_awards_write" on public.tournament_awards;
create policy "tournament_awards_write" on public.tournament_awards for all
  using (public.is_admin()) with check (public.is_admin());
