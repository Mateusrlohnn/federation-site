-- ============================================================
-- Federação Rebug — Foto (logo) do torneio
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- O torneio passa a ter DUAS imagens:
--   image_url -> banner (imagem larga, capa)
--   logo_url  -> foto/escudo do torneio (imagem quadrada)
alter table public.tournaments
  add column if not exists logo_url text;
