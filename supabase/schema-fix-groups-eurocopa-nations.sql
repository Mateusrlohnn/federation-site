-- ============================================================
-- Federação Rebug — Inversão manual de grupos (EUROCOPA e NATIONS)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql; usa tournament_teams.group_label)
--
-- A atribuição de grupos é por time, na coluna tournament_teams.group_label.
-- O admin já pode editar isso pela tela (Admin > Torneios > "Grupos (a dedo)"),
-- mas este script aplica as duas inversões pedidas de uma vez:
--
--   EUROCOPA: Holanda  -> Grupo A   |  PortugalE -> Grupo B
--   NATIONS : Georgia  -> Grupo A   |  PortugalN -> Grupo B
--
-- Casa o torneio por nome (ilike) e os times por nome sem caixa (lower/btrim).
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Helper inline por torneio: define o grupo de um time (escopado ao torneio).
-- (sem função permanente — tudo dentro de blocos do $$ ... $$)

-- ---------- EUROCOPA ----------
do $$
declare v_tour uuid;
begin
  select id into v_tour
    from public.tournaments
   where name ilike '%eurocopa%'
   order by created_at desc
   limit 1;

  if v_tour is null then
    raise notice 'EUROCOPA: nenhum torneio com nome contendo "eurocopa" — pulei.';
    return;
  end if;

  update public.tournament_teams tt
     set group_label = 'Grupo A'
   where tt.tournament_id = v_tour
     and tt.team_id in (select id from public.teams where lower(btrim(name)) = 'holanda');

  update public.tournament_teams tt
     set group_label = 'Grupo B'
   where tt.tournament_id = v_tour
     and tt.team_id in (select id from public.teams where lower(btrim(name)) = 'portugale');

  raise notice 'EUROCOPA: Holanda -> Grupo A, PortugalE -> Grupo B.';
end $$;

-- ---------- NATIONS ----------
do $$
declare v_tour uuid;
begin
  select id into v_tour
    from public.tournaments
   where name ilike '%nations%'
   order by created_at desc
   limit 1;

  if v_tour is null then
    raise notice 'NATIONS: nenhum torneio com nome contendo "nations" — pulei.';
    return;
  end if;

  update public.tournament_teams tt
     set group_label = 'Grupo A'
   where tt.tournament_id = v_tour
     and tt.team_id in (select id from public.teams where lower(btrim(name)) = 'georgia');

  update public.tournament_teams tt
     set group_label = 'Grupo B'
   where tt.tournament_id = v_tour
     and tt.team_id in (select id from public.teams where lower(btrim(name)) = 'portugaln');

  raise notice 'NATIONS: Georgia -> Grupo A, PortugalN -> Grupo B.';
end $$;
