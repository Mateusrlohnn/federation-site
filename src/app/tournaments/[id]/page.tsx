import { notFound } from "next/navigation";
import TournamentScreen, { type ScreenData } from "@/components/tournaments/TournamentScreen";
import type { TourTeam } from "@/components/tournaments/shared";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";
import { matchFromRow } from "@/lib/tournaments";
import { asPosition, type Position } from "@/lib/teams";

export const dynamic = "force-dynamic";

async function getData(id: string): Promise<ScreenData | null> {
  if (!supabaseConfigured) return null;
  try {
    const supabase = publicClient();
    const [tour, pl, te] = await Promise.all([
      supabase
        .from("tournaments")
        .select(
          "*, tournament_teams(team_id), matches(*, match_goals(player_id, goals, minute), match_assists(player_id, assists)), tournament_messages(body)",
        )
        .eq("id", id)
        .single(),
      supabase.from("players").select("id, name, position"),
      supabase.from("teams").select("id, name, logo_url"),
    ]);

    if (tour.error || !tour.data) return null;
    const r = tour.data as Record<string, unknown>;

    const playerNames: Record<string, string> = {};
    const playerPositions: Record<string, Position | null> = {};
    ((pl.data as { id: string; name: string; position: unknown }[]) ?? []).forEach((x) => {
      playerNames[x.id] = x.name;
      playerPositions[x.id] = asPosition(x.position);
    });

    const teamNames: Record<string, string> = {};
    const teamLogos: Record<string, string> = {};
    ((te.data as { id: string; name: string; logo_url: string | null }[]) ?? []).forEach((x) => {
      teamNames[x.id] = x.name;
      teamLogos[x.id] = x.logo_url ?? "";
    });

    const teamIds = ((r.tournament_teams as { team_id: string }[] | undefined) ?? []).map(
      (x) => x.team_id,
    );
    const teams: TourTeam[] = teamIds.map((tid) => ({
      id: tid,
      name: teamNames[tid] ?? "—",
      logo: teamLogos[tid] ?? "",
    }));
    const championTeamId = (r.champion_team_id as string) ?? null;

    return {
      id: r.id as string,
      name: String(r.name),
      status: String(r.status),
      banner: (r.image_url as string) ?? "",
      championTeamId,
      championName: championTeamId ? teamNames[championTeamId] ?? null : null,
      organizerName: r.organizer_id ? playerNames[r.organizer_id as string] ?? null : null,
      teams,
      matches: ((r.matches as Record<string, unknown>[]) ?? []).map(matchFromRow),
      messages: (r.tournament_messages as { body: string }[]) ?? [],
      playerNames,
      playerPositions,
      teamNames,
      teamLogos,
    };
  } catch {
    return null;
  }
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();
  return <TournamentScreen data={data} />;
}
