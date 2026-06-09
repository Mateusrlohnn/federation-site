'-- ============================================================
-- Federação Rebug — Formato "Wind Cup"
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql / schema-tournament-format.sql)
--
-- Libera o valor 'wind_cup' no CHECK da coluna `format`.
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Wind Cup: 8 times. Fase de pontos (turno único, 7 jogos por time) +
-- fase eliminatória em brackets Upper/Lower (ver src/lib/windCup.ts).
alter table public.tournaments
  drop constraint if exists tournaments_format_check;

alter table public.tournaments
  add constraint tournaments_format_check
  check (format in ('pontos_corridos', 'suico', 'grupos_mata_mata', 'mata_mata', 'wind_cup'));
