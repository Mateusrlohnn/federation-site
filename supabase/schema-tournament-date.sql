-- ============================================================
-- Federação Rebug — Data da copa (event_date)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Data em que a copa aconteceu/foi disputada. Usada para ordenar a aba
-- /torneios das mais recentes para as mais antigas. Opcional: copas sem
-- data caem na ordenação por created_at.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

alter table public.tournaments
  add column if not exists event_date date;
