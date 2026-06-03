-- ============================================================
-- Federação Rebug — Fotos de Times e Campeonatos (upload)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql + schema-teams-tournaments.sql: usa is_admin())
-- ============================================================

-- 1) Colunas de imagem -----------------------------------------
alter table public.teams       add column if not exists logo_url  text;
alter table public.tournaments add column if not exists image_url text;

-- 2) Bucket público de mídia -----------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- 3) Políticas de Storage: todos leem, só admin escreve --------
-- (storage.objects já vem com RLS habilitado no Supabase)
drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media_admin_insert" on storage.objects;
create policy "media_admin_insert" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media_admin_update" on storage.objects;
create policy "media_admin_update" on storage.objects
  for update using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "media_admin_delete" on storage.objects;
create policy "media_admin_delete" on storage.objects
  for delete using (bucket_id = 'media' and public.is_admin());
