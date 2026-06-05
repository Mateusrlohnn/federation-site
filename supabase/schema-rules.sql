-- ============================================================
-- Federação Rebug — Regras editáveis (aba Regras / /rules)
-- Rode no Supabase: SQL Editor > New query > cole tudo > Run
-- (depende de schema.sql — função public.is_admin())
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================

-- Cada linha é uma seção do regulamento (acordeão na página /rules).
create table if not exists public.rules_sections (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  content    text not null default '',
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists rules_sections_order_idx on public.rules_sections (sort_order);

alter table public.rules_sections enable row level security;
drop policy if exists "rules_read" on public.rules_sections;
create policy "rules_read" on public.rules_sections for select using (true);
drop policy if exists "rules_write" on public.rules_sections;
create policy "rules_write" on public.rules_sections for all
  using (public.is_admin()) with check (public.is_admin());

-- Seed inicial (só se a tabela estiver vazia) com o conteúdo atual da página.
do $$
begin
  if not exists (select 1 from public.rules_sections) then
    insert into public.rules_sections (title, content, sort_order) values
    ('Regras de posição', $rules$R1. Máximo de 3 jogadores em campo por equipe:
🧤 1 goleiro
🛡️ 1 zagueiro/atacante
🎯 1 meio-campista

R1.1. Ordem do nitro:
MID ataque - ATK ataque - MID defesa - ZAG defesa - GK ataque - GK defesa

R2. Substituições a qualquer momento desde que a troca seja no banco ao lado do campo que está defendendo.

R2.1. Jogador que entra antes do companheiro sair leva cartão amarelo.
Se interferir no jogo: pênalti.

R3. O jogo só começa quando todos os jogadores estiverem uniformizados.

R4. Se o árbitro esquecer de regular o nitro, o jogo deve ser reiniciado do meio campo com o cronômetro resetado.

R5. Se o nitro bugar, o árbitro poderá considerar gol em chances claras que foram interrompidas.
‣ Exemplo: bola a 1 ou 2 quadrados do gol, ou adversários longe da jogada.

R6. Todos devem estar com camiseta e calção.
Jogar sem uniforme completo = cartão amarelo.

R6.1. O único jogador autorizado a jogar de cueca é: RolaTuai 🩲$rules$, 0),
    ('Goleiro', '', 1),
    ('Jogadores de Linha', '', 2),
    ('Regras gerais', '', 3),
    ('Parâmetros de avaliação', '', 4);
  end if;
end $$;
