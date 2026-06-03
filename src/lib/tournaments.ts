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
};

export type MatchEventType =
  | "goal"
  | "penalty_goal"
  | "penalty_miss"
  | "assist"
  | "yellow_card"
  | "red_card";

export const MATCH_EVENT_TYPES: { type: MatchEventType; label: string; emoji: string }[] = [
  { type: "goal", label: "Gol", emoji: "⚽" },
  { type: "penalty_goal", label: "Pênalti convertido", emoji: "⚽" },
  { type: "penalty_miss", label: "Pênalti perdido", emoji: "🔴" },
  { type: "assist", label: "Assistência", emoji: "👟" },
  { type: "yellow_card", label: "Cartão amarelo", emoji: "🟨" },
  { type: "red_card", label: "Cartão vermelho", emoji: "🟥" },
];

export type MatchEvent = {
  playerId: string;
  teamId: string | null;
  type: MatchEventType;
  minute: number | null;
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
};

/** Um gol conta na artilharia? (gol normal ou pênalti convertido) */
export function isGoal(type: MatchEventType) {
  return type === "goal" || type === "penalty_goal";
}

/** Nº de gols de um time numa partida (placar automático). */
export function teamGoals(events: MatchEvent[], teamId: string | null): number {
  if (!teamId) return 0;
  return events.filter((e) => isGoal(e.type) && e.teamId === teamId).length;
}

/** Lista de goleadores de um time (para exibir "Aduzn 4'" embaixo do time). */
export function teamScorers(
  events: MatchEvent[],
  teamId: string | null,
): { playerId: string; minute: number | null; penalty: boolean }[] {
  if (!teamId) return [];
  return events
    .filter((e) => isGoal(e.type) && e.teamId === teamId)
    .map((e) => ({ playerId: e.playerId, minute: e.minute, penalty: e.type === "penalty_goal" }))
    .sort((a, b) => (a.minute ?? 9999) - (b.minute ?? 9999));
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
  };
}

export function matchFromRow(r: Record<string, unknown>): Match {
  const events =
    (r.match_events as
      | { player_id: string; team_id?: unknown; type: string; minute?: unknown }[]
      | undefined) ?? [];
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
    })),
  };
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
        assists: 0,
        yellow: 0,
        red: 0,
      };
    if (e.type === "goal") l.goals++;
    else if (e.type === "penalty_goal") l.penaltyGoals++;
    else if (e.type === "penalty_miss") l.penaltyMisses++;
    else if (e.type === "assist") l.assists++;
    else if (e.type === "yellow_card") l.yellow++;
    else if (e.type === "red_card") l.red++;
    map.set(e.playerId, l);
  }
  return map;
}
