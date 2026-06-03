-- ============================================================
-- Federação Rebug — Nick do Hubbe separado do nome de exibição
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- name = nome do jogador (exibição); nick = conta do Hubbe (puxa o avatar).
alter table public.players
  add column if not exists nick text;

-- Preenche o nick dos jogadores antigos com o próprio nome (mantém avatares).
update public.players set nick = name where nick is null or nick = '';
