-- ============================================================
-- Federação Rebug — Organizador do torneio
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql + schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Pessoa responsável por organizar o torneio (opcional).
alter table public.tournaments
  add column if not exists organizer_id uuid
    references public.players(id) on delete set null;
