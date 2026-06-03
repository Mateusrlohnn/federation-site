import Icon, { ICONS } from "@/components/ui/Icon";
import maxwidth from "@/styles/maxwidth.module.css";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

type TeamCard = {
  id: string;
  name: string;
  titles: number;
  runnerUps: number;
  wins: number;
  losses: number;
  roster: string[];
};

const stats: { key: keyof TeamCard; label: string; icon: keyof typeof ICONS; color: string }[] = [
  { key: "titles", label: "Títulos", icon: "trophy", color: "text-yellow-500" },
  { key: "runnerUps", label: "Vices", icon: "note-sticky", color: "text-blue-400" },
  { key: "wins", label: "Vitórias", icon: "circle-check", color: "text-green-500" },
  { key: "losses", label: "Derrotas", icon: "shield", color: "text-red-500" },
];

async function getTeams(): Promise<TeamCard[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, team_players(players(name))")
      .order("titles", { ascending: false });
    if (error || !data) return [];
    return data.map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: String(t.name),
      titles: Number(t.titles) || 0,
      runnerUps: Number(t.runner_ups) || 0,
      wins: Number(t.wins) || 0,
      losses: Number(t.losses) || 0,
      roster: ((t.team_players as { players: { name: string } | null }[]) ?? [])
        .map((x) => x.players?.name)
        .filter(Boolean) as string[],
    }));
  } catch {
    return [];
  }
}

export default async function TeamsPage() {
  const teams = await getTeams();

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      <div className="flex flex-col p-4 mb-4 w-full bg-[#2f2f2f] border border-[#454545] rounded-xl">
        <h1 className="text-xl font-bold">
          <Icon name="shield" className="text-yellow-500 mr-2" />
          Times
        </h1>
        <span className="mt-1 text-[#cfcfcf]">
          {teams.length > 0
            ? `${teams.length} times na Federação Rebug.`
            : "Os times da Federação Rebug."}
        </span>
      </div>

      {teams.length === 0 ? (
        <p className="text-gray-400 mt-6 text-center">No teams registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <article key={t.id} className="rounded-xl bg-[#2f2f2f] border border-[#454545] p-5">
              <h3 className="text-lg font-bold mb-3">{t.name}</h3>

              <div className="grid grid-cols-4 gap-2 text-center border-y border-[#454545] py-3">
                {stats.map((s) => (
                  <div key={s.key}>
                    <Icon name={s.icon} className={`${s.color} text-sm`} />
                    <div className="font-bold text-base">{t[s.key] as number}</div>
                    <div className="text-[10px] text-[#8d8d8d]">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <div className="text-xs text-[#8d8d8d] mb-1">Elenco ({t.roster.length})</div>
                {t.roster.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {t.roster.map((name) => (
                      <span
                        key={name}
                        className="bg-[#1d1d1d] border border-[#454545] rounded-full px-2 py-0.5 text-xs"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-[#8d8d8d]">Sem jogadores vinculados.</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
