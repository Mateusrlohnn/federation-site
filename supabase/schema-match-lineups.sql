-- ============================================================
-- Federação Rebug — Escalação por partida + notas dos jogadores
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- ---------- ESCALAÇÃO DA PARTIDA ----------
-- Quem realmente jogou determinada partida, em qual posição, se foi titular
-- (ou entrou por substituição) e a nota recebida no pós-jogo.
--   position    -> posição naquela partida (pode diferir da posição cadastrada)
--   is_starter  -> true: titular | false: entrou por substituição
--   rating      -> conceito da avaliação: C, B, A, A+, S, S+ (definido após o jogo)
-- Sem linhas para uma partida = súmula cai no comportamento antigo (roster).
create table if not exists public.match_lineups (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches(id)  on delete cascade,
  player_id  uuid not null references public.players(id)  on delete cascade,
  team_id    uuid references public.teams(id) on delete set null,
  position   text check (position in ('GK', 'ZAG', 'MID', 'ATK')),
  is_starter boolean not null default true,
  rating     text check (rating in ('C', 'B', 'A', 'A+', 'S', 'S+')),
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

-- Migra bases antigas: se rating ainda for numérico (0–10), troca por conceito text.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'match_lineups'
      and column_name = 'rating' and data_type = 'numeric'
  ) then
    alter table public.match_lineups drop column rating;
    alter table public.match_lineups
      add column rating text check (rating in ('C', 'B', 'A', 'A+', 'S', 'S+'));
  end if;
end $$;

alter table public.match_lineups enable row level security;
drop policy if exists "match_lineups_read" on public.match_lineups;
create policy "match_lineups_read" on public.match_lineups for select using (true);
drop policy if exists "match_lineups_write" on public.match_lineups;
create policy "match_lineups_write" on public.match_lineups for all
  using (public.is_admin()) with check (public.is_admin());
