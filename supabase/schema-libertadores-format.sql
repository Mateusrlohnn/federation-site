-- ============================================================
-- Federação Rebug — Formato "Grupos + Mata-Mata (Libertadores)"
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Libera o valor 'libertadores' no CHECK da coluna `format` e atribui esse
-- formato ao torneio da Libertadores (2 grupos), marcando o Grupo 1 com os
-- 5 times informados e o Grupo 2 com o restante.
--
-- Motor do bracket: src/lib/formats.ts (buildLibertadoresKnockout)
--   1º de cada grupo -> direto à SEMIFINAL
--   2º e 3º          -> QUARTAS cruzadas (2ºG1×3ºG2 e 2ºG2×3ºG1)
--   vencedores das quartas enfrentam os 1º nas semis -> final
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- 1) Libera o novo valor no CHECK (mantém os formatos já existentes).
alter table public.tournaments
  drop constraint if exists tournaments_format_check;

alter table public.tournaments
  add constraint tournaments_format_check
  check (format in (
    'pontos_corridos', 'suico', 'grupos_mata_mata', 'mata_mata', 'wind_cup', 'libertadores'
  ));

-- 2) Atribui o formato ao torneio da Libertadores + define os grupos.
--    Ajuste o nome no ilike e a lista de times do Grupo 1 se necessário.
do $$
declare v_tour uuid;
begin
  select id into v_tour
    from public.tournaments
   where name ilike '%libertadores%'
   order by created_at desc
   limit 1;

  if v_tour is null then
    raise notice 'Nenhum torneio com nome contendo "libertadores" encontrado — pulei a atribuição.';
    return;
  end if;

  update public.tournaments
     set format = 'libertadores', group_count = 2
   where id = v_tour;

  -- Grupo 1: os 5 times informados (casa por nome, sem caixa).
  update public.tournament_teams tt
     set group_label = 'Grupo 1'
   where tt.tournament_id = v_tour
     and tt.team_id in (
       select id from public.teams
        where lower(btrim(name)) in
          ('defensor sporting', 'nacional', 'emelec', 'palmeiras', 'sporting cristal')
     );

  -- Grupo 2: todo o restante dos times deste torneio.
  update public.tournament_teams tt
     set group_label = 'Grupo 2'
   where tt.tournament_id = v_tour
     and tt.group_label is distinct from 'Grupo 1';

  raise notice 'Libertadores: formato "libertadores" atribuído; Grupo 1/Grupo 2 definidos.';
end $$;
