-- ============================================================
-- Federação Rebug — Sorteio (chaveamento) e nº de grupos
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Número de grupos (apenas para o formato grupos_mata_mata).
alter table public.tournaments
  add column if not exists group_count int;

-- Sorteio persistido por time no campeonato:
--   seed        -> ordem do sorteio (1..n) — usada na chave/semeadura
--   group_label -> grupo atribuído (ex.: "Grupo A") na fase de grupos
alter table public.tournament_teams
  add column if not exists seed int,
  add column if not exists group_label text;
