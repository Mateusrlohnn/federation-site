-- ============================================================
-- Federação Rebug — Disputa de pênaltis (shootout) no mata-mata
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-match-events.sql)
--
-- Libera 2 tipos de evento na match_events para registrar a disputa de
-- pênaltis (quando o mata-mata empata no tempo normal):
--   shootout_goal -> pênalti convertido na disputa (⚽)
--   shootout_miss -> pênalti perdido na disputa (🔴 com ✖)
--
-- Esses eventos NÃO contam no placar da partida nem na artilharia (isGoal()
-- os ignora). O vencedor do confronto é decidido pela contagem de
-- shootout_goal por time (ver src/lib/formats.ts -> knockoutWinner).
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

alter table public.match_events drop constraint if exists match_events_type_check;
alter table public.match_events add constraint match_events_type_check check (
  type in (
    'goal', 'own_goal', 'penalty_goal', 'penalty_miss', 'assist',
    'yellow_card', 'red_card', 'substitution',
    'shootout_goal', 'shootout_miss'
  )
);
