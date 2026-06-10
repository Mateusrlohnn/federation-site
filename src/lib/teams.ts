/** Posições do elenco. Sigla curta para exibição; nome completo no cadastro. */
export type Position = "GK" | "ZAG" | "MID" | "ATK";

export const POSITIONS: { key: Position; label: string; sigla: string }[] = [
  { key: "GK", label: "Goleiro", sigla: "GK" },
  { key: "ZAG", label: "Zagueiro", sigla: "ZAG" },
  { key: "MID", label: "Meio-Campo", sigla: "MID" },
  { key: "ATK", label: "Atacante", sigla: "ATK" },
];

/** Um membro do elenco: jogador + posição + se ainda está no time. */
export type RosterMember = {
  playerId: string;
  position: Position | null;
  active: boolean; // false = já passou pelo time (ex-jogador)
};

export type Team = {
  id?: string;
  name: string;
  logoUrl: string; // foto do time (URL pública no Storage)
  ownerId: string | null; // "dono" do time (um jogador) — organiza e diferencia times homônimos
  active: boolean; // ON aparece na aba Times; OFF = time histórico (só torneios)
  titles: number;
  runnerUps: number;
  wins: number;
  losses: number;
  roster: RosterMember[]; // elenco atual + ex-jogadores
};

export type TeamFieldKey = "titles" | "runnerUps" | "wins" | "losses";

export const TEAM_FIELDS: { key: TeamFieldKey; col: string; label: string }[] = [
  { key: "titles", col: "titles", label: "Títulos" },
  { key: "runnerUps", col: "runner_ups", label: "Vices" },
  { key: "wins", col: "wins", label: "Vitórias" },
  { key: "losses", col: "losses", label: "Derrotas" },
];

export function emptyTeam(): Team {
  return {
    name: "",
    logoUrl: "",
    ownerId: null,
    active: true,
    titles: 0,
    runnerUps: 0,
    wins: 0,
    losses: 0,
    roster: [],
  };
}

/** Normaliza a posição vinda do banco para o union type (ou null). */
export function asPosition(v: unknown): Position | null {
  return v === "GK" || v === "ZAG" || v === "MID" || v === "ATK" ? v : null;
}

/** Supabase row (com team_players embutido) -> Team */
export function teamFromRow(r: Record<string, unknown>): Team {
  const roster =
    (r.team_players as { player_id: string; position?: unknown; active?: unknown }[] | undefined) ??
    [];
  return {
    id: r.id as string,
    name: String(r.name),
    logoUrl: (r.logo_url as string) ?? "",
    ownerId: (r.owner_id as string) ?? null,
    active: r.active !== false,
    titles: Number(r.titles) || 0,
    runnerUps: Number(r.runner_ups) || 0,
    wins: Number(r.wins) || 0,
    losses: Number(r.losses) || 0,
    roster: roster.map((x) => ({
      playerId: x.player_id,
      position: asPosition(x.position),
      active: x.active !== false, // default true se ausente
    })),
  };
}

/** Team -> row para gravar (sem id/elenco; elenco vai na join table) */
export function teamToRow(t: Team): Record<string, string | number | boolean | null> {
  return {
    name: t.name.trim(),
    logo_url: t.logoUrl?.trim() || null,
    owner_id: t.ownerId ?? null,
    active: t.active,
    titles: Number(t.titles) || 0,
    runner_ups: Number(t.runnerUps) || 0,
    wins: Number(t.wins) || 0,
    losses: Number(t.losses) || 0,
  };
}
