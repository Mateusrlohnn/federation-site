export type Team = {
  id?: string;
  name: string;
  logoUrl: string; // foto do time (URL pública no Storage)
  titles: number;
  runnerUps: number;
  wins: number;
  losses: number;
  playerIds: string[]; // elenco (ids de players)
};

export type TeamFieldKey = "titles" | "runnerUps" | "wins" | "losses";

export const TEAM_FIELDS: { key: TeamFieldKey; col: string; label: string }[] = [
  { key: "titles", col: "titles", label: "Títulos" },
  { key: "runnerUps", col: "runner_ups", label: "Vices" },
  { key: "wins", col: "wins", label: "Vitórias" },
  { key: "losses", col: "losses", label: "Derrotas" },
];

export function emptyTeam(): Team {
  return { name: "", logoUrl: "", titles: 0, runnerUps: 0, wins: 0, losses: 0, playerIds: [] };
}

/** Supabase row (com team_players embutido) -> Team */
export function teamFromRow(r: Record<string, unknown>): Team {
  const roster = (r.team_players as { player_id: string }[] | undefined) ?? [];
  return {
    id: r.id as string,
    name: String(r.name),
    logoUrl: (r.logo_url as string) ?? "",
    titles: Number(r.titles) || 0,
    runnerUps: Number(r.runner_ups) || 0,
    wins: Number(r.wins) || 0,
    losses: Number(r.losses) || 0,
    playerIds: roster.map((x) => x.player_id),
  };
}

/** Team -> row para gravar (sem id/elenco; elenco vai na join table) */
export function teamToRow(t: Team): Record<string, string | number | null> {
  return {
    name: t.name.trim(),
    logo_url: t.logoUrl?.trim() || null,
    titles: Number(t.titles) || 0,
    runner_ups: Number(t.runnerUps) || 0,
    wins: Number(t.wins) || 0,
    losses: Number(t.losses) || 0,
  };
}
