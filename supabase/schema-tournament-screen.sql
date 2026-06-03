-- ============================================================
-- Federação Rebug — Tela da copa: jogo ao vivo, minuto do gol, assistências
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql já ter sido rodado)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- ---------- PARTIDA AO VIVO ----------
-- Marca uma súmula como "ao vivo". O admin atualiza o placar/gols manualmente;
-- a tela pública mostra em destaque (atualiza ao recarregar).
alter table public.matches
  add column if not exists is_live boolean not null default false;

-- ---------- MINUTO DO GOL ----------
-- Permite a linha do tempo "Nanatsu '4". Cada linha de match_goals pode ter um
-- minuto; a artilharia continua somando os gols normalmente.
alter table public.match_goals
  add column if not exists minute int;

-- ---------- ASSISTÊNCIAS ----------
-- Mesma ideia de match_goals, porém para assistências (base do líder de assist.)
create table if not exists public.match_assists (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches(id)  on delete cascade,
  player_id uuid not null references public.players(id)  on delete cascade,
  assists   int  not null default 1
);

alter table public.match_assists enable row level security;
drop policy if exists "match_assists_read" on public.match_assists;
create policy "match_assists_read" on public.match_assists for select using (true);
drop policy if exists "match_assists_write" on public.match_assists;
create policy "match_assists_write" on public.match_assists for all
  using (public.is_admin()) with check (public.is_admin());
