import { notFound } from "next/navigation";
import TournamentScreen, { type ScreenData } from "@/components/tournaments/TournamentScreen";
import type { TourTeam } from "@/components/tournaments/shared";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";
import { matchFromRow } from "@/lib/tournaments";
import { asPosition, type Position } from "@/lib/teams";
import type { TournamentFormat } from "@/lib/formats";

export const dynamic = "force-dynamic";

async function getData(id: string): Promise<ScreenData | null> {
  if (!supabaseConfigured) return null;
  try {
    const supabase = publicClient();
    const [tour, pl, te, tp] = await Promise.all([
      supabase
        .from("tournaments")
        .select(
          "*, tournament_teams(team_id, seed, group_label), matches(*, match_events(player_id, team_id, type, minute, secondary_player_id), match_lineups(player_id, team_id, position, is_starter, rating)), tournament_messages(body)",
        )
        .eq("id", id)
        .single(),
      supabase.from("players").select("id, name, nick, position"),
      supabase.from("teams").select("id, name, logo_url"),
      supabase.from("team_players").select("team_id, player_id, position, active"),
    ]);

    if (tour.error || !tour.data) return null;
    const r = tour.data as Record<string, unknown>;

    const playerNames: Record<string, string> = {};
    const playerNicks: Record<string, string> = {};
    const playerPositions: Record<string, Position | null> = {};
    ((pl.data as { id: string; name: string; nick: string | null; position: unknown }[]) ?? []).forEach(
      (x) => {
        playerNames[x.id] = x.name;
        playerNicks[x.id] = x.nick?.trim() || x.name;
        playerPositions[x.id] = asPosition(x.position);
      },
    );

    const teamNames: Record<string, string> = {};
    const teamLogos: Record<string, string> = {};
    ((te.data as { id: string; name: string; logo_url: string | null }[]) ?? []).forEach((x) => {
      teamNames[x.id] = x.name;
      teamLogos[x.id] = x.logo_url ?? "";
    });

    // elencos por time (com posição/status) — usados na súmula completa
    const teamRosters: ScreenData["teamRosters"] = {};
    (
      (tp.data as { team_id: string; player_id: string; position: unknown; active: unknown }[]) ??
      []
    ).forEach((x) => {
      (teamRosters[x.team_id] ??= []).push({
        playerId: x.player_id,
        position: asPosition(x.position),
        active: x.active !== false,
      });
    });

    const ttRows =
      (r.tournament_teams as
        | { team_id: string; seed?: unknown; group_label?: unknown }[]
        | undefined) ?? [];
    // ordena pelo sorteio (seed); sem seed vai para o fim
    const teams: TourTeam[] = [...ttRows]
      .sort((x, y) => (Number(x.seed ?? 9999) || 9999) - (Number(y.seed ?? 9999) || 9999))
      .map((x) => ({
        id: x.team_id,
        name: teamNames[x.team_id] ?? "—",
        logo: teamLogos[x.team_id] ?? "",
        seed: x.seed != null ? Number(x.seed) : null,
        group: (x.group_label as string) ?? null,
      }));
    const championTeamId = (r.champion_team_id as string) ?? null;

    return {
      id: r.id as string,
      name: String(r.name),
      status: String(r.status),
      banner: (r.image_url as string) ?? "",
      logo: (r.logo_url as string) ?? "",
      championTeamId,
      championName: championTeamId ? teamNames[championTeamId] ?? null : null,
      organizerName: r.organizer_id ? playerNames[r.organizer_id as string] ?? null : null,
      format: (r.format as TournamentFormat) ?? null,
      groupCount: r.group_count != null ? Number(r.group_count) : null,
      teams,
      matches: ((r.matches as Record<string, unknown>[]) ?? []).map(matchFromRow),
      messages: (r.tournament_messages as { body: string }[]) ?? [],
      playerNames,
      playerNicks,
      playerPositions,
      teamNames,
      teamLogos,
      teamRosters,
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
