-- ============================================================
-- Federação Rebug — Cards estilo FIFA Ultimate Team (Hall da Fama)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql — tabela public.players)
--
-- Adiciona os atributos manuais do card do jogador:
--   - card_auge_overall  : overall no auge da carreira (ex.: 88)
--   - card_atual_overall : overall atual (ex.: 87)
--   - status_aposentado  : true = aposentado (card do auge vira branco "Icon")
--   - card_auge_team_id  : time exibido no card do auge (FK teams)
--   - card_atual_team_id : time exibido no card atual (FK teams)
--   - card_auge_position : posição exibida no card do auge (cai na natural se nulo)
--   - card_atual_position: posição exibida no card atual (cai na natural se nulo)
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

alter table public.players
  add column if not exists card_auge_overall  int,
  add column if not exists card_atual_overall int,
  add column if not exists status_aposentado  boolean not null default false,
  add column if not exists card_auge_team_id  uuid references public.teams(id) on delete set null,
  add column if not exists card_atual_team_id uuid references public.teams(id) on delete set null,
  add column if not exists card_auge_position  text,
  add column if not exists card_atual_position text;
