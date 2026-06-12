import { publicClient, supabaseConfigured } from "./supabase/public";
import { fromRow as fromHofRow, type HofPlayer } from "./hof";
import { asPosition, type Position } from "./teams";

export type DraftPlayer = {
  id: string;
  name: string;
  avatar: string;
  position: Position;
  overall: number;
  hofData: HofPlayer;
  teamLogo?: string;
  teamName?: string;
};

export type DraftTeam = {
  id: string;
  name: string;
  season: string;
  logoUrl: string;
  players: DraftPlayer[];
};

export type DraftSelection = Partial<Record<Position, DraftPlayer>>;

function resolvePosition(draftPos: unknown, playerPos: unknown): Position {
  return asPosition(draftPos) ?? asPosition(playerPos) ?? "ATK";
}

export function getAvatarUrl(name: string): string {
  // Conforme instrução: https://hubbe.biz/avatar/{name}img_format=png&headonly=2
  // Adicionando o '?' que parece faltar na string mas é padrão de query params
  return `https://hubbe.biz/avatar/${encodeURIComponent(name)}?img_format=png&headonly=2`;
}

export async function getDraftTeams(): Promise<DraftTeam[]> {
  if (!supabaseConfigured) return [];

  try {
    const supabase = publicClient();

    const { data, error } = await supabase
      .from("draft_teams")
      .select(`
        id,
        name,
        season,
        logo_url,
        active,
        draft_team_players (
          position,
          overall,
          player:players (*)
        )
      `)
      .eq("active", true)
      .order("season", { ascending: false });

    if (error || !data) {
      console.error("Error fetching draft teams:", error);
      return [];
    }

    return (data as any[])
      .map((team) => ({
        id: team.id,
        name: team.name,
        season: team.season ?? "",
        logoUrl: team.logo_url ?? "",
        players: ((team.draft_team_players ?? []) as any[]).map((tp) => ({
          id: tp.player.id,
          name: tp.player.name,
          avatar: getAvatarUrl(tp.player.nick?.trim() || tp.player.name),
          position: resolvePosition(tp.position, tp.player.position),
          overall: Number(tp.overall) || 75,
          hofData: fromHofRow(tp.player),
          teamLogo: team.logo_url ?? "",
          teamName: team.name,
        })),
      }))
      .filter((t) => t.players.length > 0);
  } catch (err) {
    console.error("Draft teams fetch failed:", err);
    return [];
  }
}

/**
 * Valida se o time do draft está completo com 1 jogador de cada posição.
 */
export function isDraftComplete(selection: DraftSelection): boolean {
  const positions: Position[] = ["GK", "ZAG", "MID", "ATK"];
  return positions.every(pos => !!selection[pos]);
}

/**
 * Sorteia 4 times únicos para as 4 rodadas do draft.
 */
export function shuffleDraftRounds(allTeams: DraftTeam[]): DraftTeam[] {
  return [...allTeams].sort(() => Math.random() - 0.5).slice(0, 4);
}
