-- ============================================================
-- Federação Rebug — Vice-campeão da copa
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Adiciona o time vice-campeão (em paralelo ao champion_team_id).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

alter table public.tournaments
  add column if not exists runner_up_team_id uuid references public.teams(id) on delete set null;
