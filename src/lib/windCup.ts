/**
 * WIND CUP — formato customizado (8 equipes).
 *
 * Funções PURAS (sem React/Supabase), no mesmo estilo de `lib/formats.ts`.
 * A fase de pontos reaproveita o motor de round-robin/classificação existente;
 * a fase eliminatória é um bracket próprio resolvido por dependências.
 *
 * Fluxo:
 *   Fase de pontos (turno único, 7 jogos por time) → classificação 1..8
 *     1º .................... FINALISTA (vai direto à Grande Final)
 *     2º, 3º ................ Upper 1
 *     4º, 5º ................ Lower 1
 *     6º, 7º, 8º ............ Rebaixados (fora do torneio principal)
 *
 *   Upper 1:  2º vs 3º     → vencedor: Semi | perdedor: Lower 2
 *   Lower 1:  4º vs 5º     → vencedor: Lower 2 | perdedor: FORA
 *   Lower 2:  perdedor(Upper 1) vs vencedor(Lower 1)
 *                          → vencedor: Semi | perdedor: FORA   (suporta pênaltis)
 *   Semi:     vencedor(Upper 1) vs vencedor(Lower 2)
 *                          → vencedor: Grande Final | perdedor: FORA
 *   Final:    1º vs vencedor(Semi) → vencedor: CAMPEÃO
 */

import {
  computeStandings,
  roundRobinFixtures,
  finalsByDate,
  pairKey,
  type MatchLike,
  type StandingRow,
  type FixtureRound,
} from "@/lib/formats";

export const WIND_CUP_TEAMS = 8;
export const WIND_CUP_MATCHES_PER_TEAM = 7; // todos contra todos, só ida

// ---------------------------------------------------------------------------
// FASE DE PONTOS — reaproveita o motor de pontos corridos (turno único).
//
// O turno único tem exatamente UM jogo por par de times. Como a fase
// eliminatória reenfrenta pares que já se cruzaram na liga (ex.: 2º vs 3º),
// o MESMO par pode ter 2 partidas no banco. Para não misturar as fases:
//   - a liga usa o PRIMEIRO confronto (cronológico) de cada par;
//   - o bracket usa o ÚLTIMO (a revanche), ver buildWindCupFromMatches.
// ---------------------------------------------------------------------------

/**
 * Jogos da fase de pontos: o 1º confronto (cronológico) de cada par. A 2ª vez
 * que um par se enfrenta é tratada como revanche do bracket (ver
 * buildWindCupFromMatches). Não impõe rodadas — o admin marca os jogos da fase
 * de pontos livremente, com quem quiser.
 */
export function windCupLeagueMatches(matches: MatchLike[]): MatchLike[] {
  const seen = new Set<string>();
  const out: MatchLike[] = [];
  for (const m of finalsByDate(matches)) {
    const k = pairKey(m.homeTeamId as string, m.awayTeamId as string);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(m);
  }
  return out;
}

/** (Opcional) Tabela de jogos sugerida em turno único — NÃO obrigatória na Wind Cup. */
export function windCupPointsFixtures(teamIds: string[], matches: MatchLike[]): FixtureRound[] {
  return roundRobinFixtures(teamIds, windCupLeagueMatches(matches), false);
}

/** Classificação da fase de pontos (3 pts vitória / 1 empate), já ordenada. */
export function windCupStandings(teamIds: string[], matches: MatchLike[]): StandingRow[] {
  return computeStandings(teamIds, windCupLeagueMatches(matches));
}

// ---------------------------------------------------------------------------
// PAPÉIS NA CLASSIFICAÇÃO (após as 7 rodadas).
// ---------------------------------------------------------------------------

export type WindRole = "finalista" | "upper1" | "lower1" | "rebaixado";

const ROLE_LABEL: Record<WindRole, string> = {
  finalista: "Finalista (1º)",
  upper1: "Upper 1",
  lower1: "Lower 1",
  rebaixado: "Rebaixado",
};

export function windRoleForPlace(place: number): WindRole {
  if (place === 1) return "finalista";
  if (place === 2 || place === 3) return "upper1";
  if (place === 4 || place === 5) return "lower1";
  return "rebaixado"; // 6, 7, 8
}

export type WindSeed = { place: number; teamId: string; role: WindRole; roleLabel: string };

/**
 * Mapeia a classificação (ordenada do 1º ao 8º) para os papéis da Wind Cup.
 * Aceita um array de teamIds já ordenado OU o resultado de `windCupStandings`.
 */
export function windCupSeeding(ordered: string[] | StandingRow[]): WindSeed[] {
  const ids = ordered.map((x) => (typeof x === "string" ? x : x.teamId));
  return ids.map((teamId, i) => {
    const place = i + 1;
    const role = windRoleForPlace(place);
    return { place, teamId, role, roleLabel: ROLE_LABEL[role] };
  });
}

// ---------------------------------------------------------------------------
// FASE ELIMINATÓRIA — definição estática do bracket (de onde vem / para onde vai).
// ---------------------------------------------------------------------------

export type WindStage = "upper1" | "lower1" | "lower2" | "semi" | "final";

export const WIND_STAGES: WindStage[] = ["upper1", "lower1", "lower2", "semi", "final"];

/** De onde vem cada participante de um confronto. */
export type WindSource =
  | { kind: "seed"; place: number } // posição na fase de pontos (1..5)
  | { kind: "winner"; from: WindStage } // vencedor de outro confronto
  | { kind: "loser"; from: WindStage }; // perdedor de outro confronto

/** Para onde vai o vencedor/perdedor (apenas informativo / para desenhar o fluxo). */
export type WindDest =
  | { stage: WindStage; slot: "home" | "away" }
  | "campeao"
  | "vice"
  | "out"
  | "fora-rebaixado";

export type WindTieDef = {
  stage: WindStage;
  label: string;
  home: WindSource;
  away: WindSource;
  winnerTo: WindDest;
  loserTo: WindDest;
};

export const WIND_CUP_BRACKET: WindTieDef[] = [
  {
    stage: "upper1",
    label: "Upper 1",
    home: { kind: "seed", place: 2 },
    away: { kind: "seed", place: 3 },
    winnerTo: { stage: "semi", slot: "home" },
    loserTo: { stage: "lower2", slot: "home" },
  },
  {
    stage: "lower1",
    label: "Lower 1",
    home: { kind: "seed", place: 4 },
    away: { kind: "seed", place: 5 },
    winnerTo: { stage: "lower2", slot: "away" },
    loserTo: "out",
  },
  {
    stage: "lower2",
    label: "Lower 2",
    home: { kind: "loser", from: "upper1" },
    away: { kind: "winner", from: "lower1" },
    winnerTo: { stage: "semi", slot: "away" },
    loserTo: "out",
  },
  {
    stage: "semi",
    label: "Semi-Final",
    home: { kind: "winner", from: "upper1" },
    away: { kind: "winner", from: "lower2" },
    winnerTo: { stage: "final", slot: "away" },
    loserTo: "out",
  },
  {
    stage: "final",
    label: "Grande Final",
    home: { kind: "seed", place: 1 },
    away: { kind: "winner", from: "semi" },
    winnerTo: "campeao",
    loserTo: "vice",
  },
];

// ---------------------------------------------------------------------------
// RESULTADOS — placar + (opcional) disputa de pênaltis para desempate.
// ---------------------------------------------------------------------------

export type WindResult = {
  homeScore: number;
  awayScore: number;
  homePens?: number | null; // pênaltis (só usados quando o tempo normal empata)
  awayPens?: number | null;
};

export type WindResults = Partial<Record<WindStage, WindResult>>;

/** Atualiza imutavelmente o placar de um confronto (para "salvar o jogo"). */
export function setWindResult(
  results: WindResults,
  stage: WindStage,
  result: WindResult,
): WindResults {
  return { ...results, [stage]: result };
}

/** Remove o placar de um confronto (e tudo que dependia dele é recalculado). */
export function clearWindResult(results: WindResults, stage: WindStage): WindResults {
  const next = { ...results };
  delete next[stage];
  return next;
}

// ---------------------------------------------------------------------------
// MOTOR — resolve o bracket inteiro a partir da classificação + resultados.
// "Avançar automaticamente" = re-resolver sempre que um resultado muda.
// ---------------------------------------------------------------------------

export type WindTie = {
  stage: WindStage;
  label: string;
  home: string | null; // teamId (ou null = a definir)
  away: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePens: number | null;
  awayPens: number | null;
  winner: string | null;
  loser: string | null;
  decidedByPens: boolean;
  played: boolean; // tem placar e ambos os times definidos
};

export type WindCupResult = {
  seeding: WindSeed[];
  finalist: string | null; // 1º colocado (vai direto à final)
  ties: Record<WindStage, WindTie>;
  order: WindStage[]; // ordem de disputa
  champion: string | null;
  runnerUp: string | null;
  eliminatedInBracket: string[]; // perdedores "fora" (Lower 1, Lower 2, Semi)
  relegated: string[]; // 6º, 7º e 8º da fase de pontos
};

/** Vencedor de um confronto: placar e, no empate, pênaltis. Null = indefinido. */
function decide(
  home: string | null,
  away: string | null,
  res: WindResult | undefined,
): { winner: string | null; loser: string | null; decidedByPens: boolean } {
  if (!home || !away || !res) return { winner: null, loser: null, decidedByPens: false };
  if (res.homeScore > res.awayScore) return { winner: home, loser: away, decidedByPens: false };
  if (res.awayScore > res.homeScore) return { winner: away, loser: home, decidedByPens: false };
  // empate no tempo normal → decide nos pênaltis
  const hp = res.homePens ?? null;
  const ap = res.awayPens ?? null;
  if (hp != null && ap != null && hp !== ap) {
    return hp > ap
      ? { winner: home, loser: away, decidedByPens: true }
      : { winner: away, loser: home, decidedByPens: true };
  }
  return { winner: null, loser: null, decidedByPens: false }; // ainda indefinido
}

/** Como obter o placar de um confronto (de um mapa de resultados ou das partidas). */
type WindResultGetter = (stage: WindStage, home: string | null, away: string | null) => WindResult | undefined;

/** Núcleo: resolve o bracket em ordem de dependência usando um provedor de placar. */
function resolveCore(ordered: string[] | StandingRow[], getResult: WindResultGetter): WindCupResult {
  const seeding = windCupSeeding(ordered);
  const byPlace = (place: number): string | null => seeding[place - 1]?.teamId ?? null;
  const finalist = byPlace(1);

  const ties = {} as Record<WindStage, WindTie>;

  const resolveSource = (src: WindSource): string | null => {
    if (src.kind === "seed") return byPlace(src.place);
    const ref = ties[src.from];
    if (!ref) return null;
    return src.kind === "winner" ? ref.winner : ref.loser;
  };

  // WIND_CUP_BRACKET já está em ordem de dependência (upper1/lower1 → lower2 → semi → final).
  for (const def of WIND_CUP_BRACKET) {
    const home = resolveSource(def.home);
    const away = resolveSource(def.away);
    const res = getResult(def.stage, home, away);
    const { winner, loser, decidedByPens } = decide(home, away, res);
    const played = !!home && !!away && !!res;
    ties[def.stage] = {
      stage: def.stage,
      label: def.label,
      home,
      away,
      homeScore: res?.homeScore ?? null,
      awayScore: res?.awayScore ?? null,
      homePens: res?.homePens ?? null,
      awayPens: res?.awayPens ?? null,
      winner,
      loser,
      decidedByPens,
      played,
    };
  }

  const eliminatedInBracket = (["lower1", "lower2", "semi"] as WindStage[])
    .map((s) => ties[s].loser)
    .filter((x): x is string => !!x);

  const relegated = seeding.filter((s) => s.role === "rebaixado").map((s) => s.teamId);

  return {
    seeding,
    finalist,
    ties,
    order: WIND_STAGES,
    champion: ties.final.winner,
    runnerUp: ties.final.loser,
    eliminatedInBracket,
    relegated,
  };
}

/**
 * Resolve toda a Wind Cup a partir de um mapa de placares lançados manualmente.
 * `ordered` = classificação final da fase de pontos (do 1º ao 8º).
 */
export function resolveWindCup(
  ordered: string[] | StandingRow[],
  results: WindResults = {},
): WindCupResult {
  return resolveCore(ordered, (stage) => results[stage]);
}

/**
 * Confronto do BRACKET entre dois times = a ÚLTIMA partida entre eles (a
 * revanche pós-liga). Exige ≥2 jogos do par (1º = liga, 2º = bracket); se só
 * existe o jogo da liga, o confronto eliminatório ainda não foi disputado.
 * Retorna o placar orientado para (home, away), incluindo a disputa de pênaltis
 * (eventos shootout_goal) para decidir empates do tempo normal.
 */
function bracketMeeting(matches: MatchLike[], home: string, away: string): WindResult | undefined {
  const between = finalsByDate(matches).filter((m) => {
    const h = m.homeTeamId as string;
    const a = m.awayTeamId as string;
    return (h === home && a === away) || (h === away && a === home);
  });
  if (between.length < 2) return undefined; // só o jogo da liga (ou nenhum)
  const m = between[between.length - 1]; // o mais recente = bracket
  return m.homeTeamId === home
    ? { homeScore: m.homeScore, awayScore: m.awayScore, homePens: m.homePens ?? null, awayPens: m.awayPens ?? null }
    : { homeScore: m.awayScore, awayScore: m.homeScore, homePens: m.awayPens ?? null, awayPens: m.homePens ?? null };
}

/**
 * Resolve a Wind Cup a partir das PARTIDAS reais do torneio (fase de pontos +
 * revanches do bracket). A classificação vem da liga; cada confronto do bracket
 * é casado pela revanche entre os participantes. Avança automaticamente conforme
 * os resultados são lançados.
 */
export function buildWindCupFromMatches(
  ordered: string[] | StandingRow[],
  matches: MatchLike[],
): WindCupResult {
  return resolveCore(ordered, (_stage, home, away) =>
    home && away ? bracketMeeting(matches, home, away) : undefined,
  );
}
