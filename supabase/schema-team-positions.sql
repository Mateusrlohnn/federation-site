-- ============================================================
-- Federação Rebug — Posições no elenco + histórico + campeão de torneio
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql já ter sido rodado)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- ---------- ELENCO: posição + status ativo/ex ----------
-- position: sigla curta (GK = Goleiro, ZAG = Zagueiro, MID = Meio-Campo, ATK = Atacante)
-- active:   true  = está no time hoje
--           false = já passou pelo time (ex-jogador) — preserva o histórico
alter table public.team_players
  add column if not exists position text
    check (position in ('GK', 'ZAG', 'MID', 'ATK')),
  add column if not exists active boolean not null default true;

-- ---------- TORNEIOS: time campeão ----------
-- Permite listar as copas que cada time disputou e destacar as que venceu.
-- Os títulos passam a ser contados automaticamente a partir daqui.
alter table public.tournaments
  add column if not exists champion_team_id uuid
    references public.teams(id) on delete set null;

-- As policies de RLS são por tabela (não por coluna), então as colunas novas
-- já herdam as regras existentes: todos leem, só admin escreve.
