-- ============================================================
-- Federação Rebug — Reações no feed (like / dislike)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-posts.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- ---------- CONTADORES ----------
-- Apenas a contagem agregada (sem registrar quem votou). O controle de
-- "1 voto por pessoa" é feito no navegador (localStorage); aqui só somamos.
alter table public.posts
  add column if not exists likes    int not null default 0,
  add column if not exists dislikes int not null default 0;

-- ---------- RPC PÚBLICA DE REAÇÃO ----------
-- O público não tem permissão de UPDATE na tabela (RLS). Esta função roda
-- como SECURITY DEFINER para aplicar os deltas com segurança. O cliente envia
-- os deltas (-1, 0 ou +1) conforme o usuário curte, descurte ou troca o voto.
create or replace function public.react_post(p_id uuid, d_like int, d_dislike int)
returns public.posts
language sql
security definer
set search_path = public
as $$
  update public.posts
     set likes    = greatest(0, likes    + greatest(-1, least(1, coalesce(d_like, 0)))),
         dislikes = greatest(0, dislikes + greatest(-1, least(1, coalesce(d_dislike, 0))))
   where id = p_id
  returning *;
$$;

grant execute on function public.react_post(uuid, int, int) to anon, authenticated;
