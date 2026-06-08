import type { TournamentFormat } from "@/lib/formats";
import { asPosition, type Position } from "@/lib/teams";

export type TournamentStatus = "Em andamento" | "Finalizado" | "Em breve";

export const TOURNAMENT_STATUSES: TournamentStatus[] = [
  "Em andamento",
  "Finalizado",
  "Em breve",
];

export type Tournament = {
  id?: string;
  name: string;
  status: TournamentStatus;
  imageUrl: string; // banner (imagem larga, URL pública no Storage)
  logoUrl: string; // foto/escudo do torneio (imagem quadrada)
  teamIds: string[];
  playerIds: string[];
  championTeamId: string | null; // time campeão (opcional)
  organizerId: string | null; // organizador (opcional)
  format: TournamentFormat | null; // formato do campeonato (opcional)
  groupCount: number | null; // nº de grupos (grupos_mata_mata)
};

export type MatchEventType =
  | "goal"
  | "own_goal"
  | "penalty_goal"
  | "penalty_miss"
  | "assist"
  | "yellow_card"
  | "shootout_goal"
  | "shootout_miss"
  | "red_card"
  | "substitution";

export const MATCH_EVENT_TYPES: { type: MatchEventType; label: string; emoji: string }[] = [
  { type: "goal", label: "Gol", emoji: "⚽" },
  { type: "own_goal", label: "Gol contra", emoji: "🥅" },
  { type: "penalty_goal", label: "Pênalti convertido", emoji: "⚽" },
  { type: "penalty_miss", label: "Pênalti perdido", emoji: "🔴" },
  { type: "assist", label: "Assistência", emoji: "👟" },
  { type: "yellow_card", label: "Cartão amarelo", emoji: "🟨" },
  { type: "red_card", label: "Cartão vermelho", emoji: "🟥" },
  { type: "substitution", label: "Substituição", emoji: "🔄" },
  { type: "shootout_goal", label: "Pênalti (disputa) convertido", emoji: "⚽" },
  { type: "shootout_miss", label: "Pênalti (disputa) perdido", emoji: "🔴" },
];

export type MatchEvent = {
  playerId: string;
  teamId: string | null;
  type: MatchEventType;
  minute: number | null;
  // substituição: jogador que SAI (playerId guarda quem entra)
  outPlayerId?: string | null;
};

/** Conceitos de avaliação do jogador (do pior ao melhor). */
export type Grade = "C" | "B" | "A" | "A+" | "S" | "S+";
export const GRADES: Grade[] = ["C", "B", "A", "A+", "S", "S+"];

/** Classes de cor (bg + texto) de um conceito — usado no selo da nota. */
export function gradeClass(g: Grade): string {
  switch (g) {
    case "C":
      return "bg-loss/20 text-loss";
    case "B":
      return "bg-white/10 text-faint";
    case "A":
      return "bg-win/20 text-win";
    case "A+":
      return "bg-win/30 text-win";
    case "S":
      return "bg-gold/20 text-gold";
    case "S+":
      return "bg-gold/40 text-gold";
  }
}

/** Escalação de um jogador numa partida: posição, titularidade e nota (conceito). */
export type MatchLineup = {
  playerId: string;
  teamId: string | null;
  position: Position | null;
  isStarter: boolean;
  rating: Grade | null;
};

export type Match = {
  id?: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
  scheduled: boolean;
  mvpPlayerId: string | null;
  playedAt: string | null;
  notes: string;
  events: MatchEvent[];
  lineups: MatchLineup[];
  // Disputa de pênaltis (mata-mata): gols convertidos por lado. 0/0 = não houve.
  homePens: number;
  awayPens: number;
};

/** Um gol conta na artilharia? (gol normal ou pênalti convertido — gol contra NÃO) */
export function isGoal(type: MatchEventType) {
  return type === "goal" || type === "penalty_goal";
}

/**
 * Placar automático derivado dos eventos.
 * Gols normais/pênaltis contam para o time do autor; o gol contra (own_goal)
 * conta para o time ADVERSÁRIO ao do autor.
 */
export function matchScore(
  events: MatchEvent[],
  homeTeamId: string | null,
  awayTeamId: string | null,
): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type === "own_goal") {
      if (e.teamId === homeTeamId) away++;
      else if (e.teamId === awayTeamId) home++;
    } else if (isGoal(e.type)) {
      if (e.teamId === homeTeamId) home++;
      else if (e.teamId === awayTeamId) away++;
    }
  }
  return { home, away };
}

/**
 * Goleadores exibidos sob um time (ex.: "Aduzn 4'"): os gols dos próprios
 * jogadores + os gols contra marcados pelo adversário (marcados como `ownGoal`).
 */
export function teamScorers(
  events: MatchEvent[],
  teamId: string | null,
  opponentId: string | null = null,
): { playerId: string; minute: number | null; penalty: boolean; ownGoal: boolean }[] {
  if (!teamId) return [];
  const own = events
    .filter((e) => isGoal(e.type) && e.teamId === teamId)
    .map((e) => ({
      playerId: e.playerId,
      minute: e.minute,
      penalty: e.type === "penalty_goal",
      ownGoal: false,
    }));
  const against = events
    .filter((e) => e.type === "own_goal" && e.teamId === opponentId)
    .map((e) => ({ playerId: e.playerId, minute: e.minute, penalty: false, ownGoal: true }));
  return [...own, ...against].sort((a, b) => (a.minute ?? 9999) - (b.minute ?? 9999));
}

export type TournamentMessage = { id: string; body: string; createdAt: string };

export function emptyTournament(): Tournament {
  return {
    name: "",
    status: "Em andamento",
    imageUrl: "",
    logoUrl: "",
    teamIds: [],
    playerIds: [],
    championTeamId: null,
    organizerId: null,
    format: null,
    groupCount: null,
  };
}

export function emptyMatch(): Match {
  return {
    homeTeamId: null,
    awayTeamId: null,
    homeScore: 0,
    awayScore: 0,
    isLive: false,
    scheduled: false,
    mvpPlayerId: null,
    playedAt: null,
    notes: "",
    events: [],
    lineups: [],
  };
}

export function tournamentFromRow(r: Record<string, unknown>): Tournament {
  const teams = (r.tournament_teams as { team_id: string }[] | undefined) ?? [];
  const players = (r.tournament_players as { player_id: string }[] | undefined) ?? [];
  return {
    id: r.id as string,
    name: String(r.name),
    status: (r.status as TournamentStatus) ?? "Em andamento",
    imageUrl: (r.image_url as string) ?? "",
    logoUrl: (r.logo_url as string) ?? "",
    teamIds: teams.map((x) => x.team_id),
    playerIds: players.map((x) => x.player_id),
    championTeamId: (r.champion_team_id as string) ?? null,
    organizerId: (r.organizer_id as string) ?? null,
    format: (r.format as TournamentFormat) ?? null,
    groupCount: r.group_count != null ? Number(r.group_count) : null,
  };
}

export function matchFromRow(r: Record<string, unknown>): Match {
  const events =
    (r.match_events as
      | {
          player_id: string;
          team_id?: unknown;
          type: string;
          minute?: unknown;
          secondary_player_id?: unknown;
        }[]
      | undefined) ?? [];
  const lineups =
    (r.match_lineups as
      | {
          player_id: string;
          team_id?: unknown;
          position?: unknown;
          is_starter?: unknown;
          rating?: unknown;
        }[]
      | undefined) ?? [];
  // pênaltis da disputa = contagem de 'shootout_goal' por lado (não conta no placar).
  const homePens = events.filter(
    (e) => e.type === "shootout_goal" && (e.team_id as string) === (r.home_team_id as string),
  ).length;
  const awayPens = events.filter(
    (e) => e.type === "shootout_goal" && (e.team_id as string) === (r.away_team_id as string),
  ).length;
  return {
    id: r.id as string,
    homeTeamId: (r.home_team_id as string) ?? null,
    awayTeamId: (r.away_team_id as string) ?? null,
    homeScore: Number(r.home_score) || 0,
    awayScore: Number(r.away_score) || 0,
    isLive: r.is_live === true,
    scheduled: r.scheduled === true,
    mvpPlayerId: (r.mvp_player_id as string) ?? null,
    playedAt: (r.played_at as string) ?? null,
    notes: (r.notes as string) ?? "",
    events: events.map((e) => ({
      playerId: e.player_id,
      teamId: (e.team_id as string) ?? null,
      type: e.type as MatchEventType,
      minute: e.minute == null ? null : Number(e.minute),
      outPlayerId: (e.secondary_player_id as string) ?? null,
    })),
    lineups: lineups.map((l) => ({
      playerId: l.player_id,
      teamId: (l.team_id as string) ?? null,
      position: asPosition(l.position),
      isStarter: l.is_starter !== false,
      rating: (l.rating as Grade) ?? null,
    })),
    homePens,
    awayPens,
  };
}

/** Escalação de um time numa partida (vazio = sem escalação registrada). */
export function matchLineupFor(m: Match, teamId: string | null): MatchLineup[] {
  if (!teamId) return [];
  return m.lineups.filter((l) => l.teamId === teamId);
}

/** Estatísticas de um jogador somando TODAS as partidas de copa (súmulas). */
export type PlayerCupStats = {
  matches: number; // partidas em que entrou em campo (apareceu na escalação)
  goals: number; // gols (normais + pênaltis convertidos)
  assists: number; // assistências
  cleanSheets: number; // partidas em que o time do jogador não tomou gol
};

export function emptyCupStats(): PlayerCupStats {
  return { matches: 0, goals: 0, assists: 0, cleanSheets: 0 };
}

/**
 * Agrega, por jogador, as estatísticas de todas as partidas FINALIZADAS
 * (ignora agendadas e ao vivo).
 *
 * - matches: cada jogador escalado (titular ou que entrou) conta +1 partida.
 * - goals/assists: vêm dos eventos da partida.
 * - cleanSheets: quando um time não sofre gol na partida, TODOS os jogadores
 *   escalados daquele time ganham +1 clean sheet.
 */
export function computePlayerCupStats(matches: Match[]): Map<string, PlayerCupStats> {
  const map = new Map<string, PlayerCupStats>();
  const ensure = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = emptyCupStats();
      map.set(id, s);
    }
    return s;
  };

  for (const m of matches) {
    if (m.isLive || m.scheduled) continue; // só súmulas finalizadas

    // Partidas jogadas: cada jogador escalado conta uma vez (sem duplicar).
    const counted = new Set<string>();
    for (const l of m.lineups) {
      if (counted.has(l.playerId)) continue;
      counted.add(l.playerId);
      ensure(l.playerId).matches++;
    }

    // Gols e assistências a partir dos eventos.
    for (const e of m.events) {
      if (isGoal(e.type)) ensure(e.playerId).goals++;
      else if (e.type === "assist") ensure(e.playerId).assists++;
    }

    // Clean sheet: o time que NÃO sofreu gol credita o feito a todos os seus
    // jogadores escalados (o time mandante sofre os gols do visitante e vice-versa).
    if (m.homeTeamId && m.awayScore === 0)
      for (const l of m.lineups) if (l.teamId === m.homeTeamId) ensure(l.playerId).cleanSheets++;
    if (m.awayTeamId && m.homeScore === 0)
      for (const l of m.lineups) if (l.teamId === m.awayTeamId) ensure(l.playerId).cleanSheets++;
  }

  return map;
}

/** Soma os gols por jogador (gol normal + pênalti convertido) — artilharia. */
export function computeTopScorers(matches: Match[]): { playerId: string; goals: number }[] {
  const totals = new Map<string, number>();
  for (const m of matches) {
    for (const e of m.events) {
      if (isGoal(e.type)) totals.set(e.playerId, (totals.get(e.playerId) ?? 0) + 1);
    }
  }
  return [...totals.entries()]
    .map(([playerId, goals]) => ({ playerId, goals }))
    .sort((a, b) => b.goals - a.goals);
}

/** Soma as assistências por jogador (líder de assistências). */
export function computeTopAssists(matches: Match[]): { playerId: string; assists: number }[] {
  const totals = new Map<string, number>();
  for (const m of matches) {
    for (const e of m.events) {
      if (e.type === "assist") totals.set(e.playerId, (totals.get(e.playerId) ?? 0) + 1);
    }
  }
  return [...totals.entries()]
    .map(([playerId, assists]) => ({ playerId, assists }))
    .sort((a, b) => b.assists - a.assists);
}

/** Linha do tempo de gols de uma partida (gol/pênalti convertido), por minuto. */
export function goalTimeline(
  match: Match,
): { playerId: string; minute: number | null; penalty: boolean }[] {
  return match.events
    .filter((e) => isGoal(e.type))
    .map((e) => ({ playerId: e.playerId, minute: e.minute, penalty: e.type === "penalty_goal" }))
    .sort((a, b) => (a.minute ?? 9999) - (b.minute ?? 9999));
}

export type PlayerLine = {
  playerId: string;
  goals: number;
  penaltyGoals: number;
  penaltyMisses: number;
  ownGoals: number;
  assists: number;
  yellow: number;
  red: number;
};

/** Resultado de uma partida para um time: vitória, derrota ou empate. */
export function teamResult(m: Match, teamId: string): "win" | "loss" | "draw" {
  const forScore = m.homeTeamId === teamId ? m.homeScore : m.awayScore;
  const against = m.homeTeamId === teamId ? m.awayScore : m.homeScore;
  if (forScore > against) return "win";
  if (forScore < against) return "loss";
  return "draw";
}

/** Agrega os eventos de uma partida por jogador (para a ficha pós-jogo). */
export function playerLines(events: MatchEvent[]): Map<string, PlayerLine> {
  const map = new Map<string, PlayerLine>();
  for (const e of events) {
    const l =
      map.get(e.playerId) ??
      {
        playerId: e.playerId,
        goals: 0,
        penaltyGoals: 0,
        penaltyMisses: 0,
        ownGoals: 0,
        assists: 0,
        yellow: 0,
        red: 0,
      };
    if (e.type === "goal") l.goals++;
    else if (e.type === "penalty_goal") l.penaltyGoals++;
    else if (e.type === "own_goal") l.ownGoals++;
    else if (e.type === "penalty_miss") l.penaltyMisses++;
    else if (e.type === "assist") l.assists++;
    else if (e.type === "yellow_card") l.yellow++;
    else if (e.type === "red_card") l.red++;
    map.set(e.playerId, l);
  }
  return map;
}
