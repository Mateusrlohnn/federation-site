import TeamsView from "@/components/teams/TeamsView";
import type { TeamDetail, CupEntry, TeamPlayerStat } from "@/components/teams/TeamDetailModal";
import { asPosition } from "@/lib/teams";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

type MatchRow = {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number;
  away_score: number;
  is_live: boolean;
  scheduled: boolean;
  match_events: { player_id: string; team_id: string | null; type: string }[] | null;
};

async function getData(): Promise<{ teams: TeamDetail[]; cups: CupEntry[] }> {
  if (!supabaseConfigured) return { teams: [], cups: [] };
  try {
    const supabase = publicClient();
    const [t, tour, m, pl] = await Promise.all([
      supabase
        .from("teams")
        .select("*, team_players(player_id, position, active, players(name, nick, position))")
        .eq("active", true) // só times ON aparecem na aba Times
        .order("titles", { ascending: false }),
      supabase
        .from("tournaments")
        .select(
          "id, name, status, image_url, champion_team_id, runner_up_team_id, tournament_teams(team_id)",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("matches")
        .select(
          "home_team_id, away_team_id, home_score, away_score, is_live, scheduled, match_events(player_id, team_id, type)",
        ),
      supabase.from("players").select("id, name, nick"),
    ]);

    // mapa id -> nome/nick (para resolver os autores dos eventos)
    const pinfo = new Map<string, { name: string; nick: string }>();
    ((pl.data as { id: string; name: string; nick: string | null }[]) ?? []).forEach((p) =>
      pinfo.set(p.id, { name: p.name, nick: p.nick?.trim() || p.name }),
    );

    // computa vitórias/derrotas/empates e stats por jogador a partir das partidas
    const rec = new Map<string, { w: number; l: number; d: number }>();
    const recOf = (id: string) => {
      let v = rec.get(id);
      if (!v) rec.set(id, (v = { w: 0, l: 0, d: 0 }));
      return v;
    };
    const stats = new Map<string, Map<string, { goals: number; assists: number; yellow: number; red: number }>>();
    const statOf = (team: string, pid: string) => {
      let tm = stats.get(team);
      if (!tm) stats.set(team, (tm = new Map()));
      let s = tm.get(pid);
      if (!s) tm.set(pid, (s = { goals: 0, assists: 0, yellow: 0, red: 0 }));
      return s;
    };
    for (const mt of (m.data as MatchRow[] | null) ?? []) {
      if (!mt.is_live && !mt.scheduled && mt.home_team_id && mt.away_team_id) {
        const hs = Number(mt.home_score) || 0;
        const as = Number(mt.away_score) || 0;
        const h = recOf(mt.home_team_id);
        const a = recOf(mt.away_team_id);
        if (hs > as) {
          h.w++;
          a.l++;
        } else if (hs < as) {
          h.l++;
          a.w++;
        } else {
          h.d++;
          a.d++;
        }
      }
      for (const e of mt.match_events ?? []) {
        if (!e.team_id) continue;
        const s = statOf(e.team_id, e.player_id);
        if (e.type === "goal" || e.type === "penalty_goal") s.goals++;
        else if (e.type === "assist") s.assists++;
        else if (e.type === "yellow_card") s.yellow++;
        else if (e.type === "red_card") s.red++;
      }
    }

    // status do time DERIVADO das copas: títulos (champion), vices (runner_up)
    // e campeonatos jogados (toda participação em tournament_teams).
    const titlesOf = new Map<string, number>();
    const vicesOf = new Map<string, number>();
    const playedOf = new Map<string, number>();
    const bump = (map: Map<string, number>, key: string | null) => {
      if (key) map.set(key, (map.get(key) ?? 0) + 1);
    };
    (
      (tour.data as
        | {
            champion_team_id: string | null;
            runner_up_team_id: string | null;
            tournament_teams: { team_id: string }[] | null;
          }[]
        | undefined) ?? []
    ).forEach((c) => {
      bump(titlesOf, c.champion_team_id);
      bump(vicesOf, c.runner_up_team_id);
      for (const tt of c.tournament_teams ?? []) bump(playedOf, tt.team_id);
    });

    const teams: TeamDetail[] = !t.error && t.data
      ? t.data.map((r: Record<string, unknown>) => {
          const id = r.id as string;
          const tr = rec.get(id) ?? { w: 0, l: 0, d: 0 };
          const playerStats: TeamPlayerStat[] = [...(stats.get(id)?.entries() ?? [])]
            .map(([pid, s]) => ({
              name: pinfo.get(pid)?.name ?? pid,
              nick: pinfo.get(pid)?.nick,
              ...s,
            }))
            .filter((x) => x.goals || x.assists || x.yellow || x.red)
            .sort(
              (a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name),
            );
          return {
            id,
            name: String(r.name),
            logo: (r.logo_url as string) ?? "",
            titles: titlesOf.get(id) ?? 0,
            runnerUps: vicesOf.get(id) ?? 0,
            championships: playedOf.get(id) ?? 0,
            wins: tr.w,
            losses: tr.l,
            draws: tr.d,
            playerStats,
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
            .filter((rp) => rp.name)
            .sort((a, b) => a.name.localeCompare(b.name)),
          };
        })
      : [];
    // ordena pelo nº de títulos DERIVADO (a query ordenava pela coluna manual)
    teams.sort(
      (a, b) =>
        b.titles - a.titles || b.championships - a.championships || a.name.localeCompare(b.name),
    );

    const cups: CupEntry[] = !tour.error && tour.data
      ? tour.data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: String(r.name),
          status: String(r.status),
          image: (r.image_url as string) ?? "",
          championTeamId: (r.champion_team_id as string) ?? null,
          runnerUpTeamId: (r.runner_up_team_id as string) ?? null,
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
