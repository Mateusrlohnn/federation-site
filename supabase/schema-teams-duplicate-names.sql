-- ============================================================
-- Federação Rebug — Permite TIMES com o MESMO nome
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Antes, teams.name era UNIQUE: só podia existir um "Palmeiras" no banco, então
-- não dava pra criar um segundo time homônimo para outra copa. Aqui removemos
-- essa unicidade. A identidade do time passa a ser apenas o id (uuid) — o app
-- já referencia tudo por team_id (escudo, súmulas, vínculos, escalações), então
-- times de mesmo nome apenas aparecem iguais na lista, mas são independentes.
--
-- Obs.: os seeds históricos buscam o time por nome (select ... where name = ...).
-- Se você criar um segundo time com um nome usado por um seed (ex.: outro
-- "Palmeiras"), re-rodar aquele seed pode vincular-se a qualquer um dos
-- homônimos. Para o histórico ficar isolado, prefira um nome levemente diferente
-- no time novo, ou simplesmente não re-rode o seed antigo.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

do $$
declare c text;
begin
  -- Remove TODA constraint UNIQUE cuja chave seja exatamente a coluna (name).
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.teams'::regclass
      and contype = 'u'
      and conkey = (
        select array_agg(attnum order by attnum)
        from pg_attribute
        where attrelid = 'public.teams'::regclass and attname = 'name'
      )
  loop
    execute 'alter table public.teams drop constraint ' || quote_ident(c);
  end loop;
end $$;
