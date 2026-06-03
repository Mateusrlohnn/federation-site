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
  teamIds: string[];
  playerIds: string[];
};

export type MatchGoal = { playerId: string; goals: number };

export type Match = {
  id?: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  playedAt: string | null;
  notes: string;
  goals: MatchGoal[];
};

export type TournamentMessage = { id: string; body: string; createdAt: string };

export function emptyTournament(): Tournament {
  return { name: "", status: "Em andamento", teamIds: [], playerIds: [] };
}

export function emptyMatch(): Match {
  return {
    homeTeamId: null,
    awayTeamId: null,
    homeScore: 0,
    awayScore: 0,
    playedAt: null,
    notes: "",
    goals: [],
  };
}

export function tournamentFromRow(r: Record<string, unknown>): Tournament {
  const teams = (r.tournament_teams as { team_id: string }[] | undefined) ?? [];
  const players = (r.tournament_players as { player_id: string }[] | undefined) ?? [];
  return {
    id: r.id as string,
    name: String(r.name),
    status: (r.status as TournamentStatus) ?? "Em andamento",
    teamIds: teams.map((x) => x.team_id),
    playerIds: players.map((x) => x.player_id),
  };
}

export function matchFromRow(r: Record<string, unknown>): Match {
  const goals = (r.match_goals as { player_id: string; goals: number }[] | undefined) ?? [];
  return {
    id: r.id as string,
    homeTeamId: (r.home_team_id as string) ?? null,
    awayTeamId: (r.away_team_id as string) ?? null,
    homeScore: Number(r.home_score) || 0,
    awayScore: Number(r.away_score) || 0,
    playedAt: (r.played_at as string) ?? null,
    notes: (r.notes as string) ?? "",
    goals: goals.map((g) => ({ playerId: g.player_id, goals: Number(g.goals) || 0 })),
  };
}

/** Soma os gols por jogador a partir de uma lista de partidas (artilharia). */
export function computeTopScorers(matches: Match[]): { playerId: string; goals: number }[] {
  const totals = new Map<string, number>();
  for (const m of matches) {
    for (const g of m.goals) {
      totals.set(g.playerId, (totals.get(g.playerId) ?? 0) + g.goals);
    }
  }
  return [...totals.entries()]
    .map(([playerId, goals]) => ({ playerId, goals }))
    .sort((a, b) => b.goals - a.goals);
}
