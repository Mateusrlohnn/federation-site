-- ============================================================
-- Federação Rebug — COPA ANTIGA: "Brasileirão Rebug 2026"
-- Importado de challenge.place/c/695e6029a440c0a80a89f25f
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de: schema-teams-tournaments.sql, schema-tournament-format.sql,
--  schema-match-events.sql, schema-tournament-draw.sql)
--
-- O que este script faz:
--   • Cria os 9 times como OFF (active = false): NÃO aparecem na aba Times,
--     só existem para visualização deste torneio histórico.
--   • Cria o torneio "Brasileirão Rebug 2026" (Finalizado, pontos corridos,
--     campeão = Bahia) e vincula os 9 times.
--   • Vincula os ELENCOS: apenas jogadores que JÁ existem no Hall da Fama
--     (tabela players). Jogadores novos do torneio foram deixados de fora,
--     por opção (não dá pra escondê-los do Hall da Fama).
--   • Insere as 36 súmulas com placar + GOLS / ASSISTÊNCIAS / GOLS-CONTRA /
--     PÊNALTIS dos jogadores vinculados.
--
-- IMPORTANTE sobre os números:
--   • Placares e classificação: 100% conforme o challenge.place.
--   • Para cada jogador vinculado, o TOTAL de gols/assist/gol-contra/pênalti
--     bate exatamente com a página dele no challenge.place (artilharia,
--     líderes de assistência e gols do time ficam corretos).
--   • Como só vinculamos jogadores existentes, gols de jogadores novos
--     (Hepyan, Samthekid, Giovinazzo, Hoffman, Levi, Mr, Beel...) NÃO entram
--     na súmula — por isso a lista de gols de um jogo pode mostrar menos
--     gols que o placar. O PLACAR (resultado) está sempre correto.
--   • A fonte não tem minuto do gol → eventos sem minuto.
--
-- Idempotente: pode rodar mais de uma vez. Times existentes não são alterados
-- (on conflict do nothing); o torneio é recriado do zero a cada execução
-- (delete por nome -> cascata apaga jogos, vínculos e eventos antigos).
-- ============================================================

-- Normalizador temporário (minúsculas + sem acento) para casar nomes do Hall
-- da Fama mesmo com diferença de maiúsculas/acentos (ex.: joaowars776, Picolé).
-- pg_temp = some sozinho ao fim da sessão.
create or replace function pg_temp.norm(t text) returns text
  language sql immutable as
$f$ select btrim(translate(lower(coalesce($1,'')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')) $f$;

do $$
declare
  v_tour uuid;
  m uuid;  -- id da partida corrente
  -- times
  atl uuid; bah uuid; cru uuid; fla uuid; pal uuid;
  pay uuid; san uuid; sao uuid; vas uuid;
  -- jogadores (apenas os que já existem no Hall da Fama)
  p_carlos uuid; p_dorg uuid;                                  -- Atlético
  p_elmo uuid; p_pegaso uuid; p_zion uuid; p_govski uuid; p_holger uuid; -- Bahia
  p_suer uuid;                                                 -- Cruzeiro
  p_single uuid; p_pkzera uuid;                                -- Flamengo
  p_cezanne uuid; p_dkzinho uuid; p_nanatsu uuid; p_roswaal uuid; -- Palmeiras
  p_joao uuid;                                                 -- Paysandu
  p_aduzn uuid; p_larmen uuid; p_namour uuid; p_renzo uuid;
  p_suco uuid; p_vex uuid; p_vgod uuid;                        -- Santos
  p_alvinho uuid; p_shiver uuid; p_xcavani uuid;              -- São Paulo
  p_calleh uuid; p_knd uuid; p_mauro uuid; p_picole uuid;      -- Vasco
  missing text := '';
begin
  -- 1) TIMES (OFF) — cria só se ainda não existir (por nome); reaproveita se já
  --    existir. Sem 'on conflict' porque teams.name não é mais UNIQUE
  --    (ver schema-teams-duplicate-names.sql).
  insert into public.teams (name, active)
  select v.name, false
  from (values
    ('Atlético Mineiro'), ('Bahia'), ('Cruzeiro'),
    ('Flamengo'), ('Palmeiras'), ('Paysandu'),
    ('Santos'), ('São Paulo'), ('Vasco Da Gama')
  ) as v(name)
  where not exists (select 1 from public.teams t where t.name = v.name);

  select id into atl from public.teams where name = 'Atlético Mineiro';
  select id into bah from public.teams where name = 'Bahia';
  select id into cru from public.teams where name = 'Cruzeiro';
  select id into fla from public.teams where name = 'Flamengo';
  select id into pal from public.teams where name = 'Palmeiras';
  select id into pay from public.teams where name = 'Paysandu';
  select id into san from public.teams where name = 'Santos';
  select id into sao from public.teams where name = 'São Paulo';
  select id into vas from public.teams where name = 'Vasco Da Gama';

  -- 2) JOGADORES — busca tolerante (minúsculas/sem acento) no Hall da Fama.
  select id into p_carlos  from public.players where pg_temp.norm(name) = 'carlosnunez'      limit 1;
  select id into p_dorg    from public.players where pg_temp.norm(name) = 'dorguitasmaconha' limit 1;
  select id into p_elmo    from public.players where pg_temp.norm(name) = 'elmo'             limit 1;
  select id into p_pegaso  from public.players where pg_temp.norm(name) = 'pegaso'           limit 1;
  -- Pegaso é o top 1 histórico do Hall; se a grafia não casar, usa o de maior pontuação.
  if p_pegaso is null then
    select id into p_pegaso from public.players order by points desc, name limit 1;
  end if;
  -- No challenge.place o nick é "Zion"; no Hall da Fama está escrito "z1on" (com o número 1).
  select id into p_zion    from public.players where pg_temp.norm(name) = 'z1on'             limit 1;
  select id into p_govski  from public.players where pg_temp.norm(name) = 'govski'           limit 1;
  select id into p_holger  from public.players where pg_temp.norm(name) = 'holger'           limit 1;
  select id into p_suer    from public.players where pg_temp.norm(name) = 'suer'             limit 1;
  select id into p_single  from public.players where pg_temp.norm(name) = 'single'           limit 1;
  select id into p_pkzera  from public.players where pg_temp.norm(name) = 'pkzera'           limit 1;
  select id into p_cezanne from public.players where pg_temp.norm(name) = 'cezanne'          limit 1;
  select id into p_dkzinho from public.players where pg_temp.norm(name) = 'dkzinho'          limit 1;
  select id into p_nanatsu from public.players where pg_temp.norm(name) = 'nanatsu'          limit 1;
  select id into p_roswaal from public.players where pg_temp.norm(name) = 'roswaal'          limit 1;
  select id into p_joao    from public.players where pg_temp.norm(name) = 'joaowars776'      limit 1;
  select id into p_aduzn   from public.players where pg_temp.norm(name) = 'aduzn'            limit 1;
  select id into p_larmen  from public.players where pg_temp.norm(name) = 'larmen'           limit 1;
  select id into p_namour  from public.players where pg_temp.norm(name) = 'namour'           limit 1;
  select id into p_renzo   from public.players where pg_temp.norm(name) = 'renzo'            limit 1;
  select id into p_suco    from public.players where pg_temp.norm(name) = 'suco'             limit 1;
  select id into p_vex     from public.players where pg_temp.norm(name) = 'vex'              limit 1;
  select id into p_vgod    from public.players where pg_temp.norm(name) = 'vgod'             limit 1;
  select id into p_alvinho from public.players where pg_temp.norm(name) = 'alvinhoyakusa'    limit 1;
  select id into p_shiver  from public.players where pg_temp.norm(name) = 'shiver'           limit 1;
  select id into p_xcavani from public.players where pg_temp.norm(name) = 'xcavani'          limit 1;
  select id into p_calleh  from public.players where pg_temp.norm(name) = 'calleh'           limit 1;
  select id into p_knd     from public.players where pg_temp.norm(name) = 'knd'              limit 1;
  select id into p_mauro   from public.players where pg_temp.norm(name) = 'maurosn'          limit 1;
  select id into p_picole  from public.players where pg_temp.norm(name) = 'picole'           limit 1;

  -- valida: se algum nome não existir, aborta com mensagem clara.
  if p_carlos  is null then missing := missing || 'CarlosNunez, ';      end if;
  if p_dorg    is null then missing := missing || 'dorguitasmaconha, '; end if;
  if p_elmo    is null then missing := missing || 'Elmo, ';             end if;
  if p_pegaso  is null then missing := missing || 'Pegaso, ';           end if;
  if p_zion    is null then missing := missing || 'ZioN, ';             end if;
  if p_govski  is null then missing := missing || 'Govski, ';           end if;
  if p_holger  is null then missing := missing || 'Holger, ';           end if;
  if p_suer    is null then missing := missing || 'SueR, ';             end if;
  if p_single  is null then missing := missing || 'Single, ';           end if;
  if p_pkzera  is null then missing := missing || 'pkzera, ';           end if;
  if p_cezanne is null then missing := missing || 'Cezanne, ';          end if;
  if p_dkzinho is null then missing := missing || 'Dkzinho, ';          end if;
  if p_nanatsu is null then missing := missing || 'Nanatsu, ';          end if;
  if p_roswaal is null then missing := missing || 'Roswaal, ';          end if;
  if p_joao    is null then missing := missing || 'JoaoWars776, ';      end if;
  if p_aduzn   is null then missing := missing || 'aduzn, ';            end if;
  if p_larmen  is null then missing := missing || 'LarmeN, ';           end if;
  if p_namour  is null then missing := missing || 'Namour, ';           end if;
  if p_renzo   is null then missing := missing || 'Renzo, ';            end if;
  if p_suco    is null then missing := missing || 'Suco, ';             end if;
  if p_vex     is null then missing := missing || 'Vex, ';              end if;
  if p_vgod    is null then missing := missing || 'VGod, ';             end if;
  if p_alvinho is null then missing := missing || 'AlvinhoYakusa, ';    end if;
  if p_shiver  is null then missing := missing || 'Shiver, ';           end if;
  if p_xcavani is null then missing := missing || 'xCavani, ';          end if;
  if p_calleh  is null then missing := missing || 'Calleh, ';           end if;
  if p_knd     is null then missing := missing || 'KND, ';              end if;
  if p_mauro   is null then missing := missing || 'MauroSN, ';          end if;
  if p_picole  is null then missing := missing || 'Picole, ';           end if;
  if missing <> '' then
    raise exception 'Jogadores não encontrados no Hall da Fama (ajuste o nome): %', missing;
  end if;

  -- 3) Remove torneio anterior de mesmo nome (idempotência; cascata).
  delete from public.tournaments where name = 'Brasileirão Rebug 2026';

  -- 4) TORNEIO — Finalizado, pontos corridos, campeão = Bahia.
  insert into public.tournaments (name, status, format, champion_team_id)
  values ('Brasileirão Rebug 2026', 'Finalizado', 'pontos_corridos', bah)
  returning id into v_tour;

  -- 5) Times participantes (seed = posição final na tabela).
  insert into public.tournament_teams (tournament_id, team_id, seed) values
    (v_tour, bah, 1), (v_tour, pal, 2), (v_tour, vas, 3), (v_tour, fla, 4),
    (v_tour, cru, 5), (v_tour, atl, 6), (v_tour, sao, 7), (v_tour, san, 8),
    (v_tour, pay, 9);

  -- 6) ELENCOS (team_players) — só jogadores existentes no Hall da Fama.
  insert into public.team_players (team_id, player_id) values
    (atl, p_carlos), (atl, p_dorg),
    (bah, p_elmo), (bah, p_pegaso), (bah, p_zion), (bah, p_govski), (bah, p_holger),
    (cru, p_suer),
    (fla, p_single), (fla, p_pkzera),
    (pal, p_cezanne), (pal, p_dkzinho), (pal, p_nanatsu), (pal, p_roswaal),
    (pay, p_joao),
    (san, p_aduzn), (san, p_larmen), (san, p_namour), (san, p_renzo),
    (san, p_suco), (san, p_vex), (san, p_vgod),
    (sao, p_alvinho), (sao, p_shiver), (sao, p_xcavani),
    (vas, p_calleh), (vas, p_knd), (vas, p_mauro), (vas, p_picole)
  on conflict (team_id, player_id) do nothing;

  -- 7) SÚMULAS — 36 jogos. Cada bloco: insere a partida e depois os eventos
  --    dos jogadores vinculados (gols/assist/gol-contra/pênalti).

  -- Rodada (jogo 1)
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, atl, pay, 1, 0) returning id into m;

  -- jogo 2: Bahia 6 x 0 Atlético
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, bah, atl, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_elmo, bah, 'goal'), (m, p_govski, bah, 'goal'),
    (m, p_pegaso, bah, 'goal'), (m, p_pegaso, bah, 'goal'), (m, p_pegaso, bah, 'goal');

  -- jogo 3: Flamengo 7 x 1 Cruzeiro
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, fla, cru, 7, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_suer, cru, 'assist');

  -- jogo 4: Flamengo 4 x 0 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, fla, sao, 4, 0) returning id into m;

  -- jogo 5: Palmeiras 6 x 0 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pal, sao, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_cezanne, pal, 'penalty_goal'), (m, p_cezanne, pal, 'goal'), (m, p_cezanne, pal, 'goal'),
    (m, p_nanatsu, pal, 'goal'), (m, p_nanatsu, pal, 'goal'), (m, p_nanatsu, pal, 'goal'),
    (m, p_roswaal, pal, 'assist'), (m, p_roswaal, pal, 'assist'), (m, p_roswaal, pal, 'assist');

  -- jogo 6: Bahia 6 x 0 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, bah, sao, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_zion, bah, 'goal'), (m, p_zion, bah, 'goal'), (m, p_zion, bah, 'goal'),
    (m, p_elmo, bah, 'goal'),
    (m, p_elmo, bah, 'assist'), (m, p_pegaso, bah, 'assist');

  -- jogo 7: Palmeiras 0 x 1 Bahia
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pal, bah, 0, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_elmo, bah, 'goal'), (m, p_pegaso, bah, 'assist');

  -- jogo 8: Palmeiras 6 x 0 Atlético
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pal, atl, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_roswaal, pal, 'goal'), (m, p_roswaal, pal, 'goal'),
    (m, p_cezanne, pal, 'goal'), (m, p_cezanne, pal, 'goal'),
    (m, p_cezanne, pal, 'assist'), (m, p_cezanne, pal, 'assist');

  -- jogo 9: Palmeiras 6 x 0 Cruzeiro
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pal, cru, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_roswaal, pal, 'goal'), (m, p_roswaal, pal, 'goal'), (m, p_roswaal, pal, 'goal'),
    (m, p_dkzinho, pal, 'goal'),
    (m, p_suer, cru, 'own_goal'),
    (m, p_cezanne, pal, 'assist'), (m, p_cezanne, pal, 'assist'), (m, p_cezanne, pal, 'assist'),
    (m, p_roswaal, pal, 'assist');

  -- jogo 10: Paysandu 0 x 6 Palmeiras
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pay, pal, 0, 6) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_cezanne, pal, 'goal'), (m, p_cezanne, pal, 'goal'), (m, p_cezanne, pal, 'goal'),
    (m, p_roswaal, pal, 'goal'),
    (m, p_cezanne, pal, 'assist'),
    (m, p_roswaal, pal, 'assist'), (m, p_roswaal, pal, 'assist');

  -- jogo 11: Cruzeiro 4 x 0 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, cru, sao, 4, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_suer, cru, 'goal'),
    (m, p_suer, cru, 'assist'), (m, p_suer, cru, 'assist');

  -- jogo 12: Santos 1 x 2 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, san, sao, 1, 2) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_xcavani, sao, 'goal'), (m, p_shiver, sao, 'penalty_goal'),
    (m, p_shiver, sao, 'assist');

  -- jogo 13: Palmeiras 7 x 1 Santos
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pal, san, 7, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_roswaal, pal, 'goal'),
    (m, p_cezanne, pal, 'goal'), (m, p_cezanne, pal, 'goal'),
    (m, p_suco, san, 'penalty_goal'), (m, p_suco, san, 'own_goal'),
    (m, p_cezanne, pal, 'assist'), (m, p_cezanne, pal, 'assist'), (m, p_cezanne, pal, 'assist'),
    (m, p_roswaal, pal, 'assist'), (m, p_roswaal, pal, 'assist');

  -- jogo 14: Atlético 9 x 1 Santos
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, atl, san, 9, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_dorg, atl, 'goal'), (m, p_dorg, atl, 'goal'),
    (m, p_namour, san, 'goal'),
    (m, p_vgod, san, 'own_goal'), (m, p_vgod, san, 'own_goal');

  -- jogo 15: Atlético 6 x 2 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, atl, sao, 6, 2) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_xcavani, sao, 'goal'), (m, p_xcavani, sao, 'goal'),
    (m, p_dorg, atl, 'assist'), (m, p_dorg, atl, 'assist'), (m, p_dorg, atl, 'assist'),
    (m, p_shiver, sao, 'assist');

  -- jogo 16: Bahia 3 x 0 Vasco
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, bah, vas, 3, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_zion, bah, 'goal'), (m, p_zion, bah, 'goal'), (m, p_pegaso, bah, 'goal'),
    (m, p_pegaso, bah, 'assist'), (m, p_pegaso, bah, 'assist'),
    (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist');

  -- jogo 17: Flamengo 5 x 1 Atlético
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, fla, atl, 5, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_single, fla, 'goal'), (m, p_single, fla, 'goal'), (m, p_single, fla, 'goal'),
    (m, p_carlos, atl, 'own_goal');

  -- jogo 18: Paysandu 0 x 4 Vasco
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pay, vas, 0, 4) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_knd, vas, 'goal'),
    (m, p_knd, vas, 'assist'), (m, p_knd, vas, 'assist'), (m, p_knd, vas, 'assist'),
    (m, p_calleh, vas, 'assist'), (m, p_calleh, vas, 'assist');

  -- jogo 19: Palmeiras 1 x 0 Vasco
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pal, vas, 1, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_nanatsu, pal, 'goal'), (m, p_cezanne, pal, 'assist');

  -- jogo 20: Flamengo 2 x 1 Paysandu
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, fla, pay, 2, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_single, fla, 'goal'), (m, p_single, fla, 'own_goal');

  -- jogo 21: Flamengo 2 x 1 Santos
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, fla, san, 2, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_vex, san, 'goal'), (m, p_aduzn, san, 'assist');

  -- jogo 22: Atlético 1 x 2 Cruzeiro
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, atl, cru, 1, 2) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_suer, cru, 'goal'), (m, p_suer, cru, 'assist');

  -- jogo 23: Bahia 6 x 0 Cruzeiro
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, bah, cru, 6, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_elmo, bah, 'goal'),
    (m, p_pegaso, bah, 'goal'),
    (m, p_zion, bah, 'goal'), (m, p_zion, bah, 'goal'), (m, p_zion, bah, 'goal'),
    (m, p_suer, cru, 'own_goal'),
    (m, p_zion, bah, 'assist'), (m, p_zion, bah, 'assist'), (m, p_zion, bah, 'assist'),
    (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist'),
    (m, p_pegaso, bah, 'assist'), (m, p_pegaso, bah, 'assist');

  -- jogo 24: Bahia 5 x 0 Santos
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, bah, san, 5, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_pegaso, bah, 'penalty_goal'), (m, p_pegaso, bah, 'goal'),
    (m, p_zion, bah, 'goal'), (m, p_zion, bah, 'goal'), (m, p_zion, bah, 'goal'),
    (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist'),
    (m, p_pegaso, bah, 'assist'), (m, p_pegaso, bah, 'assist');

  -- jogo 25: Bahia 5 x 0 Paysandu
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, bah, pay, 5, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_pegaso, bah, 'goal'), (m, p_pegaso, bah, 'goal'), (m, p_pegaso, bah, 'goal'),
    (m, p_holger, bah, 'goal'), (m, p_elmo, bah, 'goal'),
    (m, p_pegaso, bah, 'assist'), (m, p_pegaso, bah, 'assist'), (m, p_pegaso, bah, 'assist'),
    (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist');

  -- jogo 26: Atlético 1 x 2 Vasco
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, atl, vas, 1, 2) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_calleh, vas, 'own_goal');

  -- jogo 27: Paysandu 3 x 3 Cruzeiro
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pay, cru, 3, 3) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_joao, pay, 'goal'),
    (m, p_suer, cru, 'goal'), (m, p_suer, cru, 'own_goal'), (m, p_suer, cru, 'assist');

  -- jogo 28: Vasco 1 x 0 Flamengo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, vas, fla, 1, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_knd, vas, 'goal');

  -- jogo 29: Palmeiras 2 x 0 Flamengo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pal, fla, 2, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_cezanne, pal, 'goal'), (m, p_roswaal, pal, 'goal'),
    (m, p_cezanne, pal, 'assist');

  -- jogo 30: Bahia 5 x 0 Flamengo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, bah, fla, 5, 0) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_govski, bah, 'goal'),
    (m, p_pegaso, bah, 'goal'), (m, p_pegaso, bah, 'goal'), (m, p_pegaso, bah, 'goal'),
    (m, p_pkzera, fla, 'own_goal'),
    (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist'), (m, p_elmo, bah, 'assist');

  -- jogo 31: Cruzeiro 0 x 3 Vasco
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, cru, vas, 0, 3) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_calleh, vas, 'goal'), (m, p_calleh, vas, 'goal'), (m, p_knd, vas, 'goal'),
    (m, p_calleh, vas, 'assist'), (m, p_knd, vas, 'assist');

  -- jogo 32: Cruzeiro 1 x 0 Santos
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, cru, san, 1, 0) returning id into m;

  -- jogo 33: Vasco 1 x 1 Santos
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, vas, san, 1, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_mauro, vas, 'own_goal'), (m, p_knd, vas, 'assist');

  -- jogo 34: Vasco 5 x 1 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, vas, sao, 5, 1) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_calleh, vas, 'goal'), (m, p_calleh, vas, 'goal'), (m, p_calleh, vas, 'goal');

  -- jogo 35: Paysandu 1 x 7 Santos
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pay, san, 1, 7) returning id into m;
  insert into public.match_events (match_id, player_id, team_id, type) values
    (m, p_vex, san, 'goal'), (m, p_vex, san, 'goal'), (m, p_vex, san, 'goal'), (m, p_vex, san, 'goal'),
    (m, p_aduzn, san, 'goal'), (m, p_aduzn, san, 'goal'),
    (m, p_vgod, san, 'goal'),
    (m, p_vex, san, 'assist'), (m, p_namour, san, 'assist'),
    (m, p_aduzn, san, 'assist'), (m, p_aduzn, san, 'assist');

  -- jogo 36: Paysandu 0 x 1 São Paulo
  insert into public.matches (tournament_id, home_team_id, away_team_id, home_score, away_score)
    values (v_tour, pay, sao, 0, 1) returning id into m;

  raise notice 'Brasileirão Rebug 2026: 9 times (OFF), 29 jogadores vinculados, 36 jogos com eventos.';
end $$;
