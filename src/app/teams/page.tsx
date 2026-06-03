import TeamsView from "@/components/teams/TeamsView";
import type { TeamDetail, CupEntry } from "@/components/teams/TeamDetailModal";
import { asPosition } from "@/lib/teams";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

async function getData(): Promise<{ teams: TeamDetail[]; cups: CupEntry[] }> {
  if (!supabaseConfigured) return { teams: [], cups: [] };
  try {
    const supabase = publicClient();
    const [t, tour] = await Promise.all([
      supabase
        .from("teams")
        .select("*, team_players(player_id, position, active, players(name, nick, position))")
        .eq("active", true) // só times ON aparecem na aba Times
        .order("titles", { ascending: false }),
      supabase
        .from("tournaments")
        .select("id, name, status, image_url, champion_team_id, tournament_teams(team_id)")
        .order("created_at", { ascending: false }),
    ]);

    const teams: TeamDetail[] = !t.error && t.data
      ? t.data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: String(r.name),
          logo: (r.logo_url as string) ?? "",
          titles: Number(r.titles) || 0,
          runnerUps: Number(r.runner_ups) || 0,
          wins: Number(r.wins) || 0,
          losses: Number(r.losses) || 0,
          roster: (
            (r.team_players as
              | {
                  players: { name: string; nick?: string; position?: unknown } | null;
                  position?: unknown;
                  active?: unknown;
                }[]
              | undefined) ?? []
          )
            .map((x) => ({
              name: x.players?.name ?? "",
              nick: x.players?.nick?.trim() || (x.players?.name ?? ""),
              // posição específica do time tem prioridade; senão, a natural do jogador
              position: asPosition(x.position) ?? asPosition(x.players?.position),
              active: x.active !== false,
            }))
            .filter((m) => m.name)
            .sort((a, b) => a.name.localeCompare(b.name)),
        }))
      : [];

    const cups: CupEntry[] = !tour.error && tour.data
      ? tour.data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: String(r.name),
          status: String(r.status),
          image: (r.image_url as string) ?? "",
          championTeamId: (r.champion_team_id as string) ?? null,
          teamIds: ((r.tournament_teams as { team_id: string }[] | undefined) ?? []).map(
            (x) => x.team_id,
          ),
        }))
      : [];

    return { teams, cups };
  } catch {
    return { teams: [], cups: [] };
  }
}

export default async function TeamsPage() {
  const { teams, cups } = await getData();
  return <TeamsView teams={teams} cups={cups} />;
}
