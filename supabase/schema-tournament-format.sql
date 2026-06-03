-- ============================================================
-- Federação Rebug — Formato do campeonato
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Formato do campeonato (define a geração de tabelas/chaves):
--   pontos_corridos    -> todos contra todos (tabela de classificação)
--   suico              -> sistema suíço (chaveamento por recorde)
--   grupos_mata_mata   -> fase de grupos + mata-mata
--   mata_mata          -> eliminatórias diretas (chave)
alter table public.tournaments
  add column if not exists format text
    check (format in ('pontos_corridos', 'suico', 'grupos_mata_mata', 'mata_mata'));
