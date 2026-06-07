/**
 * Motores de geração de tabelas/chaves dos campeonatos — FUNÇÕES PURAS.
 *
 * Sem dependência de React/Supabase: recebem ids de times + partidas e
 * devolvem estruturas (rodadas, classificação, chaves). Fáceis de testar.
 *
 * `MatchLike` é satisfeito estruturalmente por `Match` (lib/tournaments).
 */

export type TournamentFormat =
  | "pontos_corridos"
  | "suico"
  | "grupos_mata_mata"
  | "mata_mata"
  | "wind_cup";

export const TOURNAMENT_FORMATS: {
  value: TournamentFormat;
  label: string;
  desc: string;
}[] = [
  { value: "pontos_corridos", label: "Pontos Corridos", desc: "Todos contra todos (tabela)." },
  { value: "suico", label: "Sistema Suíço", desc: "Chaveamento por recorde de V/D." },
  { value: "grupos_mata_mata", label: "Grupos + Mata-Mata", desc: "Fase de grupos e eliminatórias." },
  { value: "mata_mata", label: "Mata-Mata", desc: "Eliminatórias diretas (chave)." },
  { value: "wind_cup", label: "Wind Cup", desc: "8 times: pontos (7 jogos) + bracket Upper/Lower." },
];

export function formatLabel(f: TournamentFormat | null): string {
  return TOURNAMENT_FORMATS.find((x) => x.value === f)?.label ?? "—";
}

export type MatchLike = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  scheduled: boolean;
  isLive: boolean;
  playedAt?: string | null;
};

/** Uma partida só conta para a tabela quando finalizada (nem agendada nem ao vivo). */
export function isFinal(m: MatchLike): boolean {
  return !m.scheduled && !m.isLive && !!m.homeTeamId && !!m.awayTeamId;
}

export const BYE = "__BYE__";

export type Pairing = { home: string; away: string }; // away === BYE => folga
export type Round = { label: string; pairings: Pairing[] };

// ---------------------------------------------------------------------------
// PONTOS CORRIDOS — método do círculo (round robin). Trata nº ímpar com BYE.
// ---------------------------------------------------------------------------
export function generateRoundRobin(teamIds: string[], doubleRound = false): Round[] {
  const teams = [...teamIds];
  if (teams.length < 2) return [];
  if (teams.length % 2 !== 0) teams.push(BYE); // folga para nº ímpar
  const n = teams.length;
  const half = n / 2;
  const fixed = teams[0];
  let rotating = teams.slice(1);
  const rounds: Round[] = [];

  for (let r = 0; r < n - 1; r++) {
    const arr = [fixed, ...rotating];
    const pairings: Pairing[] = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      // alterna mando para distribuir casa/fora
      const pairing = (r + i) % 2 === 0 ? { home: a, away: b } : { home: b, away: a };
      pairings.push(pairing);
    }
    rounds.push({ label: `Rodada ${r + 1}`, pairings });
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)]; // gira
  }

  if (doubleRound) {
    const turno = rounds.length;
    rounds.forEach((rd, i) => {
      rounds.push({
        label: `Rodada ${turno + i + 1}`,
        pairings: rd.pairings.map((p) => ({ home: p.away, away: p.home })),
      });
    });
  }
  return rounds;
}

/** Nº de rodadas (turno único) — n par => n-1; n ímpar => n. */
export function roundRobinRounds(n: number): number {
  if (n < 2) return 0;
  return n % 2 === 0 ? n - 1 : n;
}

/**
 * Jogos por rodada (Rodada 1, 2, ...) com o placar resolvido para os já
 * jogados e NULO para os que ainda não aconteceram. Mostra a tabela de jogos
 * completa, mesmo antes de as partidas serem realizadas.
 */
export type FixtureMatch = {
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
};
export type FixtureRound = { label: string; matches: FixtureMatch[] };

export function roundRobinFixtures(
  teamIds: string[],
  matches: MatchLike[],
  doubleRound = false,
): FixtureRound[] {
  const finals = matches.filter(
    (m) => isFinal(m) && !!m.homeTeamId && !!m.awayTeamId,
  );
  const findScore = (a: string, b: string): { hs: number | null; as: number | null } => {
    for (const m of finals) {
      const h = m.homeTeamId as string;
      const aw = m.awayTeamId as string;
      if (h === a && aw === b) return { hs: m.homeScore, as: m.awayScore };
      if (h === b && aw === a) return { hs: m.awayScore, as: m.homeScore };
    }
    return { hs: null, as: null };
  };
  return generateRoundRobin(teamIds, doubleRound).map((r) => ({
    label: r.label,
    matches: r.pairings
      .filter((p) => p.home !== BYE && p.away !== BYE)
      .map((p) => {
        const { hs, as } = findScore(p.home, p.away);
        return { home: p.home, away: p.away, homeScore: hs, awayScore: as };
      }),
  }));
}

// ---------------------------------------------------------------------------
// CLASSIFICAÇÃO — derivada das partidas finalizadas (3 pts vitória, 1 empate).
// ---------------------------------------------------------------------------
export type StandingRow = {
  teamId: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  pct: number; // aproveitamento (%)
};

export function computeStandings(teamIds: string[], matches: MatchLike[]): StandingRow[] {
  const set = new Set(teamIds);
  const rows = new Map<string, StandingRow>();
  for (const id of teamIds)
    rows.set(id, {
      teamId: id,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      pct: 0,
    });

  for (const m of matches) {
    if (!isFinal(m)) continue;
    const h = m.homeTeamId as string;
    const a = m.awayTeamId as string;
    if (!set.has(h) || !set.has(a)) continue;
    const rh = rows.get(h)!;
    const ra = rows.get(a)!;
    rh.played++;
    ra.played++;
    rh.goalsFor += m.homeScore;
    rh.goalsAgainst += m.awayScore;
    ra.goalsFor += m.awayScore;
    ra.goalsAgainst += m.homeScore;
    if (m.homeScore > m.awayScore) {
      rh.wins++;
      rh.points += 3;
      ra.losses++;
    } else if (m.homeScore < m.awayScore) {
      ra.wins++;
      ra.points += 3;
      rh.losses++;
    } else {
      rh.draws++;
      ra.draws++;
      rh.points++;
      ra.points++;
    }
  }

  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    row.pct = row.played > 0 ? Math.round((row.points / (row.played * 3)) * 100) : 0;
  }

  // ordem dos times preserva o desempate estável final
  const order = new Map(teamIds.map((id, i) => [id, i]));
  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.goalDiff - x.goalDiff ||
      y.goalsFor - x.goalsFor ||
      y.wins - x.wins ||
      (order.get(x.teamId)! - order.get(y.teamId)!),
  );
}

// ---------------------------------------------------------------------------
// FASE DE GRUPOS — divide os times em grupos equilibrados (distribuição serpente).
// ---------------------------------------------------------------------------
export function suggestGroupCount(n: number): number {
  if (n < 4) return 1;
  return Math.max(2, Math.round(n / 4)); // ~4 times por grupo
}

export type Group = { label: string; teamIds: string[] };

export function splitGroups(teamIds: string[], numGroups = suggestGroupCount(teamIds.length)): Group[] {
  const groups: Group[] = Array.from({ length: Math.max(1, numGroups) }, (_, i) => ({
    label: `Grupo ${String.fromCharCode(65 + i)}`,
    teamIds: [],
  }));
  // serpente: 0,1,2,2,1,0,... para equilibrar
  let dir = 1;
  let g = 0;
  for (const id of teamIds) {
    groups[g].teamIds.push(id);
    if (numGroups === 1) continue;
    if (dir === 1 && g === numGroups - 1) dir = -1;
    else if (dir === -1 && g === 0) dir = 1;
    else g += dir;
  }
  return groups;
}

// ---------------------------------------------------------------------------
// MATA-MATA — chave por potência de 2. Resolve vencedores pelos resultados.
// ---------------------------------------------------------------------------
export type SlotTeam = string | null; // null = a definir (TBD); BYE = folga
export type BracketMatch = {
  home: SlotTeam;
  away: SlotTeam;
  homeScore: number | null;
  awayScore: number | null;
  winner: string | null;
};
export type BracketRound = { label: string; matches: BracketMatch[] };

const ROUND_NAMES: Record<number, string> = {
  2: "Final",
  4: "Semifinais",
  8: "Quartas de final",
  16: "Oitavas de final",
  32: "16-avos de final",
  64: "32-avos de final",
};
export function knockoutRoundName(teamsInRound: number): string {
  return ROUND_NAMES[teamsInRound] ?? `Fase de ${teamsInRound}`;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(2, p);
}

/** Vencedor de um confronto direto (busca a partida finalizada entre os dois). */
export function knockoutWinner(matches: MatchLike[], a: string, b: string): string | null {
  for (const m of matches) {
    if (!isFinal(m)) continue;
    const h = m.homeTeamId as string;
    const aw = m.awayTeamId as string;
    if ((h === a && aw === b) || (h === b && aw === a)) {
      if (m.homeScore > m.awayScore) return h;
      if (m.awayScore > m.homeScore) return aw;
      return null; // empate => indefinido
    }
  }
  return null;
}

function findMatch(matches: MatchLike[], a: string, b: string): MatchLike | null {
  for (const m of matches) {
    if (!isFinal(m)) continue;
    const h = m.homeTeamId as string;
    const aw = m.awayTeamId as string;
    if ((h === a && aw === b) || (h === b && aw === a)) return m;
  }
  return null;
}

export function buildKnockout(
  seedTeamIds: string[],
  matches: MatchLike[],
  opts?: { size?: number; fillEmpty?: "bye" | "tbd" },
): BracketRound[] {
  // size: tamanho fixo da chave (ex.: 4 para Semis+Final), mesmo sem todos os
  // times definidos. fillEmpty="tbd" => vagas vazias viram "A definir" (null).
  const size = Math.max(2, opts?.size ?? nextPowerOfTwo(seedTeamIds.length));
  if (seedTeamIds.length < 2 && opts?.fillEmpty !== "tbd") return [];
  const empty: SlotTeam = opts?.fillEmpty === "tbd" ? null : BYE;
  const seeds: SlotTeam[] = [];
  for (let i = 0; i < size; i++) seeds.push(seedTeamIds[i] ?? empty);

  // rodada 1: 1º x último, 2º x penúltimo...
  let slots: SlotTeam[] = [];
  for (let i = 0; i < size / 2; i++) {
    slots.push(seeds[i]);
    slots.push(seeds[size - 1 - i]);
  }

  const rounds: BracketRound[] = [];
  let teamsInRound = size;

  while (teamsInRound >= 2) {
    const matchesArr: BracketMatch[] = [];
    const winners: SlotTeam[] = [];
    for (let i = 0; i < slots.length; i += 2) {
      const home = slots[i];
      const away = slots[i + 1];
      let winner: string | null = null;
      let homeScore: number | null = null;
      let awayScore: number | null = null;

      if (home === BYE && away && away !== BYE) winner = away;
      else if (away === BYE && home && home !== BYE) winner = home;
      else if (home && away && home !== BYE && away !== BYE) {
        const m = findMatch(matches, home, away);
        if (m) {
          homeScore = m.homeTeamId === home ? m.homeScore : m.awayScore;
          awayScore = m.homeTeamId === home ? m.awayScore : m.homeScore;
          winner = knockoutWinner(matches, home, away);
        }
      }
      matchesArr.push({
        home: home === BYE ? BYE : home,
        away: away === BYE ? BYE : away,
        homeScore,
        awayScore,
        winner,
      });
      winners.push(winner);
    }
    rounds.push({ label: knockoutRoundName(teamsInRound), matches: matchesArr });
    slots = winners;
    teamsInRound = Math.floor(teamsInRound / 2);
  }
  return rounds;
}

// ---------------------------------------------------------------------------
// SISTEMA SUÍÇO — recorde de V/D + emparelhamento por recorde + qualificação.
// ---------------------------------------------------------------------------
export type SwissRecord = {
  teamId: string;
  wins: number;
  losses: number;
  goalDiff: number; // critério de desempate
  status: "Classificado" | "Eliminado" | "Em disputa";
};

/** Chave estável de um confronto (independe do mando) — para evitar revanches. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/** Conjunto de confrontos já realizados (partidas finalizadas). */
export function playedPairs(matches: MatchLike[]): Set<string> {
  const set = new Set<string>();
  for (const m of matches)
    if (isFinal(m)) set.add(pairKey(m.homeTeamId as string, m.awayTeamId as string));
  return set;
}

/** Rodadas necessárias / limites de classificação (8 times => 2V classifica, 2D elimina). */
export function swissThresholds(n: number): { qualifyWins: number; eliminateLosses: number; rounds: number } {
  const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));
  const threshold = Math.max(1, rounds - 1);
  return { qualifyWins: threshold, eliminateLosses: threshold, rounds };
}

/**
 * Template (pré-visualização) do chaveamento suíço por nº de times:
 * todos os recordes alcançáveis (0-0 → 1-0/0-1 → 1-1 → …), com a quantidade
 * estimada de times em cada um e as transições (vence ↑ / perde ↓).
 */
export type SwissNode = {
  record: string; // "w-l"
  wins: number;
  losses: number;
  round: number; // w + l
  teams: number; // estimativa de times nesse recorde
  kind: "active" | "classified" | "eliminated";
};
export type SwissTemplate = {
  rounds: number;
  qualifyWins: number;
  eliminateLosses: number;
  byRound: SwissNode[][]; // nós agrupados por rodada (w+l)
};

export function swissTemplate(n: number): SwissTemplate {
  const { qualifyWins, eliminateLosses, rounds } = swissThresholds(Math.max(2, n));
  const counts = new Map<string, number>();
  const key = (w: number, l: number) => `${w}-${l}`;
  counts.set("0-0", Math.max(2, n));
  const maxRound = qualifyWins + eliminateLosses;

  for (let r = 0; r <= maxRound; r++) {
    for (const [k, c] of [...counts.entries()]) {
      const [w, l] = k.split("-").map(Number);
      if (w + l !== r || c <= 0) continue;
      if (w >= qualifyWins || l >= eliminateLosses) continue; // terminal
      const winners = Math.ceil(c / 2); // ímpar => 1 BYE avança
      const losers = Math.floor(c / 2);
      counts.set(key(w + 1, l), (counts.get(key(w + 1, l)) ?? 0) + winners);
      counts.set(key(w, l + 1), (counts.get(key(w, l + 1)) ?? 0) + losers);
    }
  }

  const byRound: SwissNode[][] = [];
  for (const [k, c] of counts.entries()) {
    if (c <= 0) continue;
    const [w, l] = k.split("-").map(Number);
    const kind: SwissNode["kind"] =
      w >= qualifyWins ? "classified" : l >= eliminateLosses ? "eliminated" : "active";
    (byRound[w + l] ??= []).push({ record: k, wins: w, losses: l, round: w + l, teams: c, kind });
  }
  byRound.forEach((col) => col?.sort((a, b) => b.wins - a.wins));
  return { rounds, qualifyWins, eliminateLosses, byRound: byRound.filter(Boolean) };
}

export function computeSwissRecords(teamIds: string[], matches: MatchLike[]): SwissRecord[] {
  const { qualifyWins, eliminateLosses } = swissThresholds(teamIds.length);
  const set = new Set(teamIds);
  const rec = new Map<string, { w: number; l: number; gd: number }>();
  for (const id of teamIds) rec.set(id, { w: 0, l: 0, gd: 0 });

  for (const m of matches) {
    if (!isFinal(m)) continue;
    const h = m.homeTeamId as string;
    const a = m.awayTeamId as string;
    if (!set.has(h) || !set.has(a)) continue;
    rec.get(h)!.gd += m.homeScore - m.awayScore;
    rec.get(a)!.gd += m.awayScore - m.homeScore;
    if (m.homeScore > m.awayScore) {
      rec.get(h)!.w++;
      rec.get(a)!.l++;
    } else if (m.awayScore > m.homeScore) {
      rec.get(a)!.w++;
      rec.get(h)!.l++;
    }
  }

  const order = new Map(teamIds.map((id, i) => [id, i]));
  return teamIds
    .map((id) => {
      const { w, l, gd } = rec.get(id)!;
      const status: SwissRecord["status"] =
        w >= qualifyWins ? "Classificado" : l >= eliminateLosses ? "Eliminado" : "Em disputa";
      return { teamId: id, wins: w, losses: l, goalDiff: gd, status };
    })
    .sort(
      (x, y) =>
        y.wins - x.wins ||
        x.losses - y.losses ||
        y.goalDiff - x.goalDiff ||
        order.get(x.teamId)! - order.get(y.teamId)!,
    );
}

/**
 * Reconstrói a CHAVE do sistema suíço a partir dos resultados (estilo bracket):
 * colunas por recorde (0-0 → 1-0/0-1 → 1-1 → …), cada uma com seus confrontos;
 * confrontos sugeridos (sem placar) entram na coluna do recorde atual.
 * Termina em "classificados" (atingiu o nº de vitórias) e "eliminados".
 */
export type SwissColumn = { label: string; matches: BracketMatch[] };
export type SwissBracket = {
  columns: SwissColumn[];
  classified: string[];
  eliminated: string[];
};

export function buildSwissBracket(teamIds: string[], matches: MatchLike[]): SwissBracket {
  const set = new Set(teamIds);
  const rec = new Map<string, { w: number; l: number }>();
  teamIds.forEach((id) => rec.set(id, { w: 0, l: 0 }));

  // reconstrói as rodadas processando as partidas em ordem cronológica
  const finals = matches
    .filter((m) => isFinal(m) && set.has(m.homeTeamId as string) && set.has(m.awayTeamId as string))
    .slice()
    .sort((a, b) => (a.playedAt ?? "").localeCompare(b.playedAt ?? ""));

  const cols = new Map<string, BracketMatch[]>();
  const keyOf = (w: number, l: number) => `${w}-${l}`;

  for (const m of finals) {
    const h = m.homeTeamId as string;
    const a = m.awayTeamId as string;
    const rh = rec.get(h)!;
    const key = keyOf(rh.w, rh.l); // recorde de entrada (invariante do suíço)
    if (!cols.has(key)) cols.set(key, []);
    const winner = m.homeScore > m.awayScore ? h : m.awayScore > m.homeScore ? a : null;
    cols.get(key)!.push({
      home: h,
      away: a,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      winner,
    });
    if (winner === h) {
      rh.w++;
      rec.get(a)!.l++;
    } else if (winner === a) {
      rec.get(a)!.w++;
      rh.l++;
    }
  }

  // confrontos sugeridos da próxima rodada (sem placar ainda)
  const recordsNow = computeSwissRecords(teamIds, matches);
  for (const p of generateSwissPairs(recordsNow, playedPairs(matches))) {
    if (p.away === BYE) continue;
    const r = rec.get(p.home)!;
    const key = keyOf(r.w, r.l);
    if (!cols.has(key)) cols.set(key, []);
    cols.get(key)!.push({ home: p.home, away: p.away, homeScore: null, awayScore: null, winner: null });
  }

  const columns = [...cols.entries()]
    .sort((x, y) => {
      const [xw, xl] = x[0].split("-").map(Number);
      const [yw, yl] = y[0].split("-").map(Number);
      return xw + xl - (yw + yl) || yw - xw;
    })
    .map(([label, ms]) => ({ label, matches: ms }));

  return {
    columns,
    classified: recordsNow.filter((r) => r.status === "Classificado").map((r) => r.teamId),
    eliminated: recordsNow.filter((r) => r.status === "Eliminado").map((r) => r.teamId),
  };
}

/**
 * Confrontos do suíço agrupados pelo recorde de entrada dos times:
 * inclui partidas finalizadas (recorde reconstruído) e as agendadas/sorteadas
 * (recorde atual). Usado para exibir os jogos dentro de cada pote.
 */
export function swissMatchesByRecord(
  teamIds: string[],
  matches: MatchLike[],
): Map<string, BracketMatch[]> {
  const set = new Set(teamIds);
  const rec = new Map<string, { w: number; l: number }>();
  teamIds.forEach((id) => rec.set(id, { w: 0, l: 0 }));
  const cols = new Map<string, BracketMatch[]>();
  const push = (key: string, m: BracketMatch) => {
    if (!cols.has(key)) cols.set(key, []);
    cols.get(key)!.push(m);
  };
  const keyOf = (id: string) => `${rec.get(id)!.w}-${rec.get(id)!.l}`;

  // finalizadas em ordem cronológica (reconstrói o recorde de entrada)
  const finals = matches
    .filter((m) => isFinal(m) && set.has(m.homeTeamId as string) && set.has(m.awayTeamId as string))
    .slice()
    .sort((a, b) => (a.playedAt ?? "").localeCompare(b.playedAt ?? ""));
  for (const m of finals) {
    const h = m.homeTeamId as string;
    const a = m.awayTeamId as string;
    const winner = m.homeScore > m.awayScore ? h : m.awayScore > m.homeScore ? a : null;
    push(keyOf(h), { home: h, away: a, homeScore: m.homeScore, awayScore: m.awayScore, winner });
    if (winner === h) {
      rec.get(h)!.w++;
      rec.get(a)!.l++;
    } else if (winner === a) {
      rec.get(a)!.w++;
      rec.get(h)!.l++;
    }
  }

  // agendadas/sorteadas (ainda sem placar) — só valem quando AMBOS os times
  // têm o MESMO recorde atual (confronto suíço válido). Evita confrontos
  // "stale" entre recordes diferentes aparecerem no pote errado.
  for (const m of matches) {
    if (m.scheduled && set.has(m.homeTeamId as string) && set.has(m.awayTeamId as string)) {
      const h = m.homeTeamId as string;
      const a = m.awayTeamId as string;
      const rh = rec.get(h)!;
      const ra = rec.get(a)!;
      if (rh.w === ra.w && rh.l === ra.l) {
        push(keyOf(h), { home: h, away: a, homeScore: null, awayScore: null, winner: null });
      }
    }
  }
  return cols;
}

/**
 * Emparelhamento suíço da próxima rodada: junta times com o MESMO recorde
 * (mesmas V e D), evitando revanches (`played`). Ímpar no pote => BYE.
 * Apenas times "Em disputa" são emparelhados (classificados/eliminados param).
 */
export function generateSwissPairs(
  records: SwissRecord[],
  played: Set<string> = new Set(),
): Pairing[] {
  const ativos = records.filter((r) => r.status === "Em disputa");
  // agrupa por recorde completo "V-D"
  const byRecord = new Map<string, string[]>();
  for (const r of ativos) {
    const key = `${r.wins}-${r.losses}`;
    if (!byRecord.has(key)) byRecord.set(key, []);
    byRecord.get(key)!.push(r.teamId);
  }
  // ordena potes: mais vitórias primeiro, depois menos derrotas
  const keys = [...byRecord.keys()].sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    return bw - aw || al - bl;
  });

  const pairings: Pairing[] = [];
  for (const key of keys) {
    const pot = byRecord.get(key)!;
    const used = new Set<number>();
    for (let i = 0; i < pot.length; i++) {
      if (used.has(i)) continue;
      let matched = -1;
      // procura um adversário que ainda não enfrentou
      for (let j = i + 1; j < pot.length; j++) {
        if (used.has(j)) continue;
        if (!played.has(pairKey(pot[i], pot[j]))) {
          matched = j;
          break;
        }
      }
      // fallback: se todos já se enfrentaram, pega o próximo livre
      if (matched === -1) {
        for (let j = i + 1; j < pot.length; j++)
          if (!used.has(j)) {
            matched = j;
            break;
          }
      }
      if (matched !== -1) {
        pairings.push({ home: pot[i], away: pot[matched] });
        used.add(i);
        used.add(matched);
      } else {
        pairings.push({ home: pot[i], away: BYE });
        used.add(i);
      }
    }
  }
  return pairings;
}
