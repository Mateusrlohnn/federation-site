-- ============================================================
-- Federação Rebug — COPA ANTIGA: "Champions League [RBG]"
-- Importado de challenge.place/c/69238cbda1d2f1ca48e0f3a2
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de: schema-teams-tournaments.sql, schema-tournament-format.sql,
--  schema-tournament-draw.sql, schema-match-events.sql)
--
-- O que este script faz:
--   • Cria os 8 times como OFF (active = false): NÃO aparecem na aba Times,
--     só existem para visualização deste torneio histórico.
--   • Cria o torneio "Champions League [RBG]" no formato GRUPOS + MATA-MATA
--     (grupos_mata_mata, 2 grupos), Finalizado, campeão = Barcelona, e vincula
--     os 8 times com seu grupo (group_label) e ordem (seed).
--   • Cria-ou-vincula os jogadores pelo nome (sem duplicar quem já existe no
--     Hall da Fama — casa por nome normalizado, ex.: Z1on, Pkzera, Roswaal).
--     Jogadores novos da copa são CRIADOS no Hall da Fama (com 0 pontos).
--   • Insere os 15 jogos (12 da fase de grupos + 3 do mata-mata) com PLACAR
--     exato + eventos de GOLS / GOLS-CONTRA / PÊNALTI-PERDIDO.
--
-- COMO O APP MONTA A COPA (FormatView.tsx, formato grupos_mata_mata):
--   A classificação de cada grupo é derivada dos jogos cujos DOIS times estão
--   no mesmo group_label. O mata-mata é gerado pegando 1º+2º de cada grupo
--   ([G.A-1º, G.B-1º, G.A-2º, G.B-2º]) e cruzando — o que reproduz exatamente
--   as semis Barcelona×Fiorentina e Man City×Chelsea → final Barcelona×Man City.
--   Por isso NÃO existe coluna de "fase": basta o placar e o group_label certos.
--
-- IMPORTANTE sobre os números (precisão):
--   • Placares, classificação, chaveamento e campeão: 100% conforme a fonte
--     (cada placar foi conferido contra a tabela dos grupos — bate exatamente).
--   • A fonte (challenge.place, um SPA) NÃO expõe de forma confiável QUANTOS
--     gols cada jogador fez EM CADA jogo (mostra o total do jogador no torneio
--     misturado ao do jogo). O que é confiável é QUEM marcou em cada jogo.
--   • Por isso, em cada partida os gols do time são DISTRIBUÍDOS entre os
--     marcadores reais daquele jogo, mantendo o placar exato. A súmula por
--     jogo é plausível; a artilharia individual é aproximada.
--   • 3 jogos (Barcelona 3x0 Sassuolo, Man City 3x0 Inter, Fiorentina 3x0 Inter)
--     não tinham autores legíveis na fonte → gols distribuídos entre os
--     marcadores conhecidos daquele time na copa.
--   • Assistências: a fonte só revela o assistente ao abrir cada gol ("Ver
--     Detalhes"); ainda NÃO foram incluídas neste seed (precisa ser preenchido
--     à mão — ver bloco "ASSISTÊNCIAS (TODO)" logo após as súmulas).
--   • Clean sheets e nº de partidas: derivados das ESCALAÇÕES geradas no passo 9
--     a partir do elenco conhecido de cada time → contam automaticamente no Hall
--     da Fama. Aproximado (usa só os marcadores conhecidos, não o time completo).
--   • A disputa de 3º lugar (Fiorentina × Chelsea) ficou SEM ser jogada na
--     fonte → foi omitida.
--   • A fonte não tem minuto do gol → eventos sem minuto.
--
-- Idempotente: pode rodar mais de uma vez. Times/jogadores existentes não são
-- alterados (on conflict do nothing); o torneio é recriado do zero a cada
-- execução (delete por nome -> cascata apaga jogos, vínculos e eventos antigos).
-- ============================================================

-- Normalizador temporário (minúsculas + sem acento) para casar nomes do Hall
-- da Fama mesmo com diferença de maiúsculas/acentos. pg_temp some ao fim da sessão.
create or replace function pg_temp.norm(t text) returns text
  language sql immutable as
$f$ select btrim(translate(lower(coalesce($1,'')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')) $f$;

-- Cria-ou-recupera um jogador pelo nome (casa por nome normalizado; se não
-- existir no Hall da Fama, cria com o nick exato da copa).
create or replace function pg_temp.get_player(p_name text) returns uuid
  language plpgsql as
$f$
declare v uuid;
begin
  select id into v from public.players where pg_temp.norm(name) = pg_temp.norm(p_name) limit 1;
  if v is null then
    insert into public.players (name) values (p_name) returning id into v;
  end if;
  return v;
end
$f$;

do $$
declare
  v_tour uuid;
  m uuid;  -- id da partida corrente
  -- times
  barc uuid; chel uuid; leip uuid; sass uuid;  -- Grupo A
  manc uuid; fior uuid; benf uuid; inte uuid;  -- Grupo B
  -- jogadores (cria-ou-vincula)
  p_pegaso uuid; p_lohn uuid; p_elmo uuid; p_zion uuid; p_gabriel uuid;   -- Barcelona
  p_s1mo uuid; p_suco uuid; p_vex uuid; p_namour uuid;                    -- Chelsea
  p_rolatuai uuid; p_control uuid; p_leviathan uuid;                      -- Leipzig
  p_higuain uuid; p_coutinho uuid; p_chiquinho uuid;                      -- Sassuolo
  p_dkzinho uuid; p_roswaal uuid; p_levi uuid;                           -- Manchester City
  p_modric uuid; p_mordred uuid; p_pkzera uuid;                          -- Fiorentina
  p_handa uuid;                                                          -- Benfica
  p_shiver uuid; p_kelvin uuid;                                          -- Internazionale
begin
  -- 1) TIMES (OFF) — cria só se ainda não existir (por nome); reaproveita se já
  --    existir. Sem 'on conflict' porque teams.name não é mais UNIQUE
  --    (ver schema-teams-duplicate-names.sql).
  insert into public.teams (name, active)
  select v.name, false
  from (values
    ('Barcelona'), ('Chelsea'), ('Leipzig'), ('Sassuolo'),
    ('Manchester City'), ('Fiorentina'), ('Benfica'), ('Internazionale')
  ) as v(name)
  where not exists (select 1 from public.teams t where t.name = v.name);

  select id into barc from public.teams where name = 'Barcelona';
  select id into chel from public.teams where name = 'Chelsea';
  select id into leip from public.teams where name = 'Leipzig';
  select id into sass from public.teams where name = 'Sassuolo';
  select id into manc from public.teams where name = 'Manchester City';
  select id into fior from public.teams where name = 'Fiorentina';
  select id into benf from public.teams where name = 'Benfica';
  select id into inte from public.teams where name = 'Internazionale';

  -- 2) JOGADORES — cria-ou-vincula pelo nome (não duplica quem já existe).
  p_pegaso    := pg_temp.get_player('Pegaso');
  p_lohn      := pg_temp.get_player('lohn?');
  p_elmo      := pg_temp.get_player('Elmo');
  p_zion      := pg_temp.get_player('Z1on');
  p_gabriel   := pg_temp.get_player('Gabriel');
  p_s1mo      := pg_temp.get_player('S1mo');
  p_suco      := pg_temp.get_player('Suco');
  p_vex       := pg_temp.get_player('Vex');
  p_namour    := pg_temp.get_player('Namour');
  p_rolatuai  := pg_temp.get_player('RolaTuai');
  p_control   := pg_temp.get_player('Control');
  p_leviathan := pg_temp.get_player('Leviathan');
  p_higuain   := pg_temp.get_player('Higuain');
  p_coutinho  := pg_temp.get_player('Coutinho');
  p_chiquinho := pg_temp.get_player('Chiquinho');
  p_dkzinho   := pg_temp.get_player('Dkzinho');
  p_roswaal   := pg_temp.get_player('Roswaal');
  p_levi      := pg_temp.get_player('Levi');
  p_modric    := pg_temp.get_player('Modric');
  p_mordred   := pg_temp.get_player('Mordred');
  p_pkzera    := pg_temp.get_player('Pkzera');
  p_handa     := pg_temp.get_player('Handa');
  p_shiver    := pg_temp.get_player('Shiver');
  p_kelvin    := pg_temp.get_player('Kelvin');

  -- 3) Remove torneio anterior de mesmo nome (idempotência; cascata).
  delete from public.tournaments where name = 'Champions League [RBG]';

  -- 4) TORNEIO — Finalizado, grupos + mata-mata (2 grupos), campeão = Barcelona.
  insert into public.tournaments (name, status, format, group_count, champion_team_id)
  values ('Champions League [RBG]', 'Finalizado', 'grupos_mata_mata', 2, barc)
  returning id into v_tour;

  -- 5) Times participantes — group_label define o grupo; seed = ordem do sorteio.
  --    Grupo A = "Grupo 1" da fonte (Barcelona...) ; Grupo B = "Grupo 2" (Man City...).
  insert into public.tournament_teams (tournament_id, team_id, seed, group_label) values
    (v_tour, barc, 1, 'Grupo A'), (v_tour, chel, 2, 'Grupo A'),
    (v_tour, leip, 3, 'Grupo A'), (v_tour, sass, 4, 'Grupo A'),
    (v_tour, manc, 5, 'Grupo B'), (v_tour, fior, 6, 'Grupo B'),
    (v_tour, benf, 7, 'Grupo B'), (v_tour, inte, 8, 'Grupo B');

  -- 6) ELENCOS (team_players, active=false = histórico) — só marcadores conhecidos.
  insert into public.team_players (team_id, player_id, active) values
    (barc, p_pegaso, false), (barc, p_lohn, false), (barc, p_elmo, false),
    (barc, p_zion, false), (barc, p_gabriel, false),
    (chel, p_s1mo, false), (chel, p_suco, false), (chel, p_vex, false), (chel, p_namour, false),
    (leip, p_rolatuai, false), (leip, p_control, false), (leip, p_leviathan, false),
    (sass, p_higuain, false), (sass, p_coutinho, false), (sass, p_chiquinho, false),
    (manc, p_dkzinho, false), (manc, p_roswaal, false), (manc, p_levi, false),
    (fior, p_modric, false), (fior, p_mordred, false), (fior, p_pkzera, false),
    (benf, p_handa, false),
    (inte, p_shiver, false), (inte, p_kelvin, false)
  on conflict (team_id, player_id) do nothing;

  -- 7) JOGADORES vinculados ao torneio (lista de elenco da copa).
  insert into public.tournament_players (tournament_id, player_id) values
    (v_tour, p_pegaso), (v_tour, p_lohn), (v_tour, p_elmo), (v_tour, p_zion), (v_tour, p_gabriel),
    (v_tour, p_s1mo), (v_tour, p_suco), (v_tour, p_vex), (v_tour, p_namour),
    (v_tour, p_rolatuai), (v_tour, p_control), (v_tour, p_leviathan),
    (v_tour, p_higuain), (v_tour, p_coutinho), (v_tour, p_chiquinho),
    (v_tour, p_dkzinho), (v_tour, p_roswaal), (v_tour, p_levi),
    (v_tour, p_modric), (v_tour, p_mordred), (v_tour, p_pkzera),
    (v_tour, p_handa), (v_tour, p_shiver), (v_tour, p_kelvin)
  on conflict (tournament_id, player_id) do nothing;

  -- 8) SÚMULAS — 12 jogos de grupo + 3 de mata-mata. Placar exato; gols
  --    distribuídos entre os marcadores reais de cada jogo (own_goal: team_id
  --    é do AUTOR; conta no placar do adversário).

  -- ===================== GRUPO A (Grupo 1) =====================

  -- A1: Barcelona 7 x 1 Chelsea  (pênalti perdido: Gabriel)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, barc, chel, 7, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_pegaso, barc, 'goal'), (m, p_pegaso, barc, 'goal'), (m, p_pegaso, barc, 'goal'),
    (m, p_lohn, barc, 'goal'), (m, p_lohn, barc, 'goal'),
    (m, p_elmo, barc, 'goal'), (m, p_elmo, barc, 'goal'),
    (m, p_s1mo, chel, 'goal'),
    (m, p_gabriel, barc, 'penalty_miss');

  -- A2: Chelsea 6 x 0 Sassuolo  (2 gols-contra de Higuain; amarelo S1mo)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, chel, sass, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_suco, chel, 'goal'), (m, p_suco, chel, 'goal'),
    (m, p_vex, chel, 'goal'), (m, p_namour, chel, 'goal'),
    (m, p_higuain, sass, 'own_goal'), (m, p_higuain, sass, 'own_goal'),
    (m, p_s1mo, chel, 'yellow_card');

  -- A3: Barcelona 6 x 1 Leipzig
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, barc, leip, 6, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_lohn, barc, 'goal'), (m, p_lohn, barc, 'goal'),
    (m, p_pegaso, barc, 'goal'), (m, p_pegaso, barc, 'goal'),
    (m, p_elmo, barc, 'goal'), (m, p_elmo, barc, 'goal'),
    (m, p_rolatuai, leip, 'goal');

  -- A4: Barcelona 3 x 0 Sassuolo  (fonte sem autores → distribuído entre marcadores do Barça)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, barc, sass, 3, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_pegaso, barc, 'goal'), (m, p_lohn, barc, 'goal'), (m, p_elmo, barc, 'goal');

  -- A5: Chelsea 2 x 1 Leipzig
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, chel, leip, 2, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_suco, chel, 'goal'), (m, p_suco, chel, 'goal'),
    (m, p_leviathan, leip, 'goal');

  -- A6: Leipzig 6 x 3 Sassuolo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, leip, sass, 6, 3) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_control, leip, 'goal'), (m, p_control, leip, 'goal'),
    (m, p_rolatuai, leip, 'goal'), (m, p_rolatuai, leip, 'goal'),
    (m, p_leviathan, leip, 'goal'), (m, p_leviathan, leip, 'goal'),
    (m, p_coutinho, sass, 'goal'), (m, p_coutinho, sass, 'goal'),
    (m, p_chiquinho, sass, 'goal');

  -- ===================== GRUPO B (Grupo 2) =====================

  -- B1: Benfica 0 x 6 Fiorentina
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, benf, fior, 0, 6) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_modric, fior, 'goal'), (m, p_modric, fior, 'goal'), (m, p_modric, fior, 'goal'),
    (m, p_mordred, fior, 'goal'), (m, p_mordred, fior, 'goal'), (m, p_mordred, fior, 'goal');

  -- B2: Benfica 3 x 1 Internazionale  (2 gols-contra do Inter: Shiver e Kelvin)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, benf, inte, 3, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_handa, benf, 'goal'),
    (m, p_shiver, inte, 'own_goal'), (m, p_kelvin, inte, 'own_goal'),
    (m, p_shiver, inte, 'goal');

  -- B3: Benfica 0 x 5 Manchester City
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, benf, manc, 0, 5) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_dkzinho, manc, 'goal'), (m, p_dkzinho, manc, 'goal'),
    (m, p_roswaal, manc, 'goal'), (m, p_roswaal, manc, 'goal'),
    (m, p_levi, manc, 'goal');

  -- B4: Manchester City 3 x 0 Internazionale  (fonte sem autores → distribuído no Man City)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, manc, inte, 3, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_dkzinho, manc, 'goal'), (m, p_roswaal, manc, 'goal'), (m, p_levi, manc, 'goal');

  -- B5: Manchester City 1 x 0 Fiorentina
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, manc, fior, 1, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_dkzinho, manc, 'goal');

  -- B6: Fiorentina 3 x 0 Internazionale  (fonte sem autores → distribuído na Fiorentina)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, fior, inte, 3, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_modric, fior, 'goal'), (m, p_modric, fior, 'goal'), (m, p_mordred, fior, 'goal');

  -- ===================== FASE 2 — MATA-MATA =====================

  -- Semifinal 1: Barcelona 6 x 0 Fiorentina  (gol-contra de Pkzera)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, barc, fior, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_zion, barc, 'goal'), (m, p_zion, barc, 'goal'),
    (m, p_pegaso, barc, 'goal'), (m, p_pegaso, barc, 'goal'),
    (m, p_elmo, barc, 'goal'),
    (m, p_pkzera, fior, 'own_goal');

  -- Semifinal 2: Manchester City 3 x 1 Chelsea  (Roswaal hat-trick; gol do Chelsea
  --              sem autor na fonte → atribuído a Suco, marcador real do Chelsea)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, manc, chel, 3, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_roswaal, manc, 'goal'), (m, p_roswaal, manc, 'goal'), (m, p_roswaal, manc, 'goal'),
    (m, p_suco, chel, 'goal');

  -- Final: Barcelona 3 x 1 Manchester City  (gol-contra de Roswaal) → CAMPEÃO Barcelona
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, barc, manc, 3, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_lohn, barc, 'goal'), (m, p_elmo, barc, 'goal'),
    (m, p_roswaal, manc, 'own_goal'),
    (m, p_roswaal, manc, 'goal');

  -- ===================== ASSISTÊNCIAS (TODO) =====================
  -- A fonte só mostra o assistente ao abrir cada gol ("Ver Detalhes"). Quando
  -- esses dados forem coletados, adicione um evento 'assist' por assistência,
  -- no MESMO padrão dos gols (eles contam sozinhos no Hall da Fama). Exemplo:
  --   insert into public.match_events (match_id, player_id, team_id, type) values
  --     (m, p_pegaso, barc, 'assist');
  -- (use o id 'm' da partida correspondente, logo após o insert dos gols dela.)

  -- 9) ESCALAÇÕES (match_lineups) — geradas do elenco conhecido de cada time em
  --    TODOS os jogos que ele disputou nesta copa, para PARTIDAS e CLEAN SHEETS
  --    contarem no Hall da Fama (computePlayerCupStats usa as escalações).
  --    Aproximado: credita partida/clean sheet a todo marcador conhecido do time,
  --    mesmo que ele não tenha jogado aquele jogo específico.
  insert into public.match_lineups (match_id, player_id, team_id)
  select sides.match_id, tp.player_id, sides.team_id
  from (
    select id as match_id, home_team_id as team_id from public.matches where tournament_id = v_tour
    union all
    select id as match_id, away_team_id as team_id from public.matches where tournament_id = v_tour
  ) sides
  join public.team_players tp on tp.team_id = sides.team_id
  where tp.player_id in (
    select player_id from public.tournament_players where tournament_id = v_tour
  )
  on conflict (match_id, player_id) do nothing;

  raise notice 'Champions League [RBG]: 8 times (OFF), 24 jogadores, 2 grupos, 15 jogos com eventos + escalações. Campeão: Barcelona.';
end $$;
