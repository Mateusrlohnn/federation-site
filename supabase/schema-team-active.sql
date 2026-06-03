-- ============================================================
-- Federação Rebug — Time ON/OFF (aparece ou não na aba Times)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- active = true  (ON)  -> aparece na aba Times
-- active = false (OFF) -> time histórico: NÃO aparece em Times, mas pode ser
--                         usado em campeonatos antigos (Torneios).
alter table public.teams
  add column if not exists active boolean not null default true;
