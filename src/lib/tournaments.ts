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
  imageUrl: string; // foto do campeonato (URL pública no Storage)
  teamIds: string[];
  playerIds: string[];
  championTeamId: string | null; // time campeão (opcional)
  organizerId: string | null; // organizador (opcional)
};

export type MatchGoal = { playerId: string; goals: number; minute: number | null };
export type MatchAssist = { playerId: string; assists: number };

export type Match = {
  id?: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number;
  awayScore: number;
  isLive: boolean;
  playedAt: string | null;
  notes: string;
  goals: MatchGoal[];
  assists: MatchAssist[];
};

export type TournamentMessage = { id: string; body: string; createdAt: string };

export function emptyTournament(): Tournament {
  return {
    name: "",
    status: "Em andamento",
    imageUrl: "",
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
    playedAt: null,
    notes: "",
    goals: [],
    assists: [],
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
    teamIds: teams.map((x) => x.team_id),
    playerIds: players.map((x) => x.player_id),
    championTeamId: (r.champion_team_id as string) ?? null,
    organizerId: (r.organizer_id as string) ?? null,
  };
}

export function matchFromRow(r: Record<string, unknown>): Match {
  const goals =
    (r.match_goals as { player_id: string; goals: number; minute?: unknown }[] | undefined) ?? [];
  const assists =
    (r.match_assists as { player_id: string; assists: number }[] | undefined) ?? [];
  return {
    id: r.id as string,
    homeTeamId: (r.home_team_id as string) ?? null,
    awayTeamId: (r.away_team_id as string) ?? null,
    homeScore: Number(r.home_score) || 0,
    awayScore: Number(r.away_score) || 0,
    isLive: r.is_live === true,
    playedAt: (r.played_at as string) ?? null,
    notes: (r.notes as string) ?? "",
    goals: goals.map((g) => ({
      playerId: g.player_id,
      goals: Number(g.goals) || 0,
      minute: g.minute == null ? null : Number(g.minute),
    })),
    assists: assists.map((a) => ({ playerId: a.player_id, assists: Number(a.assists) || 0 })),
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

/** Soma as assistências por jogador (líder de assistências). */
export function computeTopAssists(matches: Match[]): { playerId: string; assists: number }[] {
  const totals = new Map<string, number>();
  for (const m of matches) {
    for (const a of m.assists) {
      totals.set(a.playerId, (totals.get(a.playerId) ?? 0) + a.assists);
    }
  }
  return [...totals.entries()]
    .map(([playerId, assists]) => ({ playerId, assists }))
    .sort((a, b) => b.assists - a.assists);
}

/**
 * Linha do tempo de gols de uma partida (cada gol uma entrada com minuto).
 * Uma linha de match_goals com goals=N vira N entradas. Ordena pelo minuto
 * (sem minuto vai para o fim).
 */
export function goalTimeline(match: Match): { playerId: string; minute: number | null }[] {
  const events: { playerId: string; minute: number | null }[] = [];
  for (const g of match.goals) {
    const n = Math.max(1, g.goals);
    for (let i = 0; i < n; i++) events.push({ playerId: g.playerId, minute: g.minute });
  }
  return events.sort((a, b) => (a.minute ?? 9999) - (b.minute ?? 9999));
}
