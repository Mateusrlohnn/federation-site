import TournamentsView from "@/components/tournaments/TournamentsView";
import type { TournamentView, TourTeam } from "@/components/tournaments/shared";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";
import { matchFromRow } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

async function getData(): Promise<{
  tournaments: TournamentView[];
  teamNames: Record<string, string>;
  playerNames: Record<string, string>;
}> {
  const empty = { tournaments: [], teamNames: {}, playerNames: {} };
  if (!supabaseConfigured) return empty;
  try {
    const supabase = publicClient();
    const [t, p, te] = await Promise.all([
      supabase
        .from("tournaments")
        .select(
          "*, tournament_teams(team_id), matches(*, match_events(player_id, team_id, type, minute)), tournament_messages(body)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("players").select("id, name"),
      supabase.from("teams").select("id, name, logo_url"),
    ]);

    const playerNames: Record<string, string> = {};
    ((p.data as { id: string; name: string }[]) ?? []).forEach((x) => {
      playerNames[x.id] = x.name;
    });
    const teamNames: Record<string, string> = {};
    const teamLogo: Record<string, string> = {};
    ((te.data as { id: string; name: string; logo_url: string | null }[]) ?? []).forEach((x) => {
      teamNames[x.id] = x.name;
      teamLogo[x.id] = x.logo_url ?? "";
    });

    if (t.error || !t.data) return { ...empty, teamNames, playerNames };

    const tournaments: TournamentView[] = t.data.map((r: Record<string, unknown>) => {
      const teamIds = ((r.tournament_teams as { team_id: string }[] | undefined) ?? []).map(
        (x) => x.team_id,
      );
      const championTeamId = (r.champion_team_id as string) ?? null;
      const teams: TourTeam[] = teamIds.map((id) => ({
        id,
        name: teamNames[id] ?? "—",
        logo: teamLogo[id] ?? "",
      }));
      return {
        id: r.id as string,
        name: String(r.name),
        status: String(r.status),
        banner: (r.image_url as string) ?? "",
        logo: (r.logo_url as string) ?? "",
        championTeamId,
        championName: championTeamId ? teamNames[championTeamId] ?? null : null,
        teams,
        matches: ((r.matches as Record<string, unknown>[]) ?? []).map(matchFromRow),
        messages: (r.tournament_messages as { body: string }[]) ?? [],
      };
    });

    return { tournaments, teamNames, playerNames };
  } catch {
    return empty;
  }
}

export default async function TournamentsPage() {
  const { tournaments, playerNames } = await getData();
  return <TournamentsView tournaments={tournaments} playerNames={playerNames} />;
}
