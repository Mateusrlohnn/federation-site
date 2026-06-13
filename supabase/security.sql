-- ============================================================================
-- Segurança do banco (RLS) — Federação Rebug
-- ----------------------------------------------------------------------------
-- COMO USAR:
--   1. Abra o Supabase Dashboard > SQL Editor.
--   2. Cole TODO este arquivo e clique em "Run".
--   3. Cadastre os admins (passo 4 abaixo) com o UID de cada usuário.
--   4. Em Authentication > Providers > Email, DESLIGUE "Enable signups"
--      (assim ninguém cria conta sozinho; você cria os admins na mão).
--
-- Modelo de segurança: TODOS podem LER (o site público precisa). Só quem está
-- na tabela `admins` pode ESCREVER (insert/update/delete). A chave anon que
-- vai pro navegador fica inofensiva para escrita.
-- ============================================================================

-- 1) Tabela de administradores ------------------------------------------------
-- RLS ligado e SEM políticas => ninguém lê/escreve via API (anon/authenticated).
-- Você gerencia esta tabela pelo Dashboard ou via service_role.
create table if not exists public.admins (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- 2) Função que diz se o usuário atual é admin --------------------------------
-- SECURITY DEFINER: consegue ler `admins` mesmo com RLS bloqueando a tabela.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where id = auth.uid())
$$;

-- 3) Aplicar RLS + políticas em todas as tabelas de dados ---------------------
-- Idempotente: pode rodar quantas vezes quiser.
-- >>> Se você criar tabelas novas no futuro, adicione o nome nesta lista. <<<
do $$
declare
  t text;
  tabelas text[] := array[
    'players',
    'teams',
    'tournaments',
    'tournament_teams',
    'matches',
    'match_events',
    'match_lineups',
    'posts',
    'rules_sections',
    'draft_teams',
    'draft_team_players'
  ];
begin
  foreach t in array tabelas loop
    -- pula nomes que (ainda) não existem, sem quebrar o script
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'Tabela %.% nao existe — pulando', 'public', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "leitura_publica" on public.%I', t);
    execute format(
      'create policy "leitura_publica" on public.%I for select using (true)', t
    );

    execute format('drop policy if exists "escrita_admin" on public.%I', t);
    execute format(
      'create policy "escrita_admin" on public.%I for all '
      || 'using (public.is_admin()) with check (public.is_admin())', t
    );
  end loop;
end $$;

-- 4) Cadastrar admins ---------------------------------------------------------
-- Pegue o UID em Authentication > Users (coluna "UID"). Repita por admin.
--   insert into public.admins (id, email)
--   values ('00000000-0000-0000-0000-000000000000', 'fulano@email.com')
--   on conflict (id) do nothing;

-- 5) Verificação --------------------------------------------------------------
-- Rode para conferir que RLS está ligado (rowsecurity = true) em todas:
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
