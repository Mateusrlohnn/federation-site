-- ============================================================
-- Federação Rebug — W.O. (walkover) nas partidas
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Marca uma partida como vencida por W.O. (um time não compareceu). O placar
-- já é gravado refletindo o beneficiado (3×0), então classificação e mata-mata
-- funcionam normalmente; a flag `wo` serve para exibir o selo "W.O.".
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

alter table public.matches
  add column if not exists wo boolean not null default false;
