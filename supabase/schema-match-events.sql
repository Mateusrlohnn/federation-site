-- ============================================================
-- Federação Rebug — Eventos da partida (gols, pênaltis, assistências, cartões)
-- + MVP da partida
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema-teams-tournaments.sql)
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- ---------- MVP DA PARTIDA ----------
-- Definido só após o fim da partida (no ao vivo, depois que o admin encerra).
alter table public.matches
  add column if not exists mvp_player_id uuid
    references public.players(id) on delete set null;

-- ---------- EVENTOS DA PARTIDA ----------
-- Cada linha é um evento de um jogador:
--   goal          -> gol normal (⚽)
--   own_goal      -> gol contra (🥅; conta no placar do time ADVERSÁRIO ao do autor)
--   penalty_goal  -> pênalti convertido (⚽ + marcação de pênalti)
--   penalty_miss  -> pênalti perdido (bola vermelha)
--   assist        -> assistência (chuteira)
--   yellow_card   -> cartão amarelo
--   red_card      -> cartão vermelho
--   substitution  -> substituição (player_id = quem ENTRA; secondary_player_id = quem SAI)
-- minute: minuto do evento (opcional). team_id: time do jogador no jogo.
create table if not exists public.match_events (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches(id)  on delete cascade,
  player_id uuid not null references public.players(id)  on delete cascade,
  team_id   uuid references public.teams(id) on delete set null,
  -- substituição: jogador que SAI (player_id guarda quem entra)
  secondary_player_id uuid references public.players(id) on delete set null,
  type      text not null check (
    type in ('goal', 'own_goal', 'penalty_goal', 'penalty_miss', 'assist', 'yellow_card', 'red_card', 'substitution', 'shootout_goal', 'shootout_miss')
  ),
  minute    int,
  created_at timestamptz not null default now()
);

-- Coluna do jogador que sai (substituição) em bases já existentes.
alter table public.match_events
  add column if not exists secondary_player_id uuid references public.players(id) on delete set null;

-- Atualiza o CHECK em bases já existentes para aceitar 'own_goal' e 'substitution'.
alter table public.match_events drop constraint if exists match_events_type_check;
alter table public.match_events add constraint match_events_type_check check (
  type in ('goal', 'own_goal', 'penalty_goal', 'penalty_miss', 'assist', 'yellow_card', 'red_card', 'substitution')
);

alter table public.match_events enable row level security;
drop policy if exists "match_events_read" on public.match_events;
create policy "match_events_read" on public.match_events for select using (true);
drop policy if exists "match_events_write" on public.match_events;
create policy "match_events_write" on public.match_events for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- MIGRA OS DADOS ANTIGOS (só se ainda não houver eventos) ----------
-- Transforma cada gol/assistência (que eram contagens) em eventos individuais.
do $$
begin
  if not exists (select 1 from public.match_events) then
    insert into public.match_events (match_id, player_id, type, minute)
      select g.match_id, g.player_id, 'goal', g.minute
      from public.match_goals g
      cross join generate_series(1, greatest(g.goals, 1));

    insert into public.match_events (match_id, player_id, type)
      select a.match_id, a.player_id, 'assist'
      from public.match_assists a
      cross join generate_series(1, greatest(a.assists, 1));
  end if;
end $$;
