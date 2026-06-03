-- ============================================================
-- Federação Rebug — Partidas agendadas (próximas partidas)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Marca uma partida como "agendada" (próxima partida, ainda sem resultado).
--   scheduled = true  -> próxima partida (aparece em "próximas partidas")
--   scheduled = false -> já é súmula (finalizada) ou está ao vivo
alter table public.matches
  add column if not exists scheduled boolean not null default false;
