-- ============================================================
-- Federação Rebug — Feed global (mural tipo Twitter)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql — função public.is_admin())
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- ---------- POSTS DO FEED ----------
-- Mural do site inteiro (não vinculado a uma copa). Só o admin publica; o
-- público apenas visualiza. Cada linha é um post:
--   author_type -> 'admin' hoje (coluna mantida p/ futuro login de usuários)
--   author_name -> nome de exibição
--   media_url   -> arquivo no storage (pasta feed/) OU link de vídeo
--   media_kind  -> 'image' | 'video' | 'youtube' (para renderizar)
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_type text not null check (author_type in ('admin', 'user')),
  author_name text not null,
  body        text not null,
  media_url   text,
  media_kind  text check (media_kind in ('image', 'video', 'youtube')),
  created_at  timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

-- leitura pública
drop policy if exists "posts_read" on public.posts;
create policy "posts_read" on public.posts for select using (true);

-- inserir: somente admin (o público só visualiza)
drop policy if exists "posts_insert" on public.posts;
create policy "posts_insert" on public.posts for insert
  with check (public.is_admin());

-- editar/apagar: só admin (moderação)
drop policy if exists "posts_admin_update" on public.posts;
create policy "posts_admin_update" on public.posts for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "posts_admin_delete" on public.posts;
create policy "posts_admin_delete" on public.posts for delete using (public.is_admin());
