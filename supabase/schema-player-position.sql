-- ============================================================
-- Federação Rebug — Posição natural do jogador
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql já ter sido rodado)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Posição "natural" / principal do jogador (opcional).
-- GK = Goleiro, ZAG = Zagueiro, MID = Meio-Campo, ATK = Atacante.
-- O jogador pode atuar em outra posição em um time específico — isso continua
-- sendo definido em team_players.position. Quando o time não define uma
-- posição específica, a página do time usa esta posição natural como padrão.
alter table public.players
  add column if not exists position text
    check (position in ('GK', 'ZAG', 'MID', 'ATK'));

-- As policies de RLS são por tabela; a coluna nova herda as regras existentes.
