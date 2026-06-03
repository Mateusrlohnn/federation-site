import Icon, { ICONS } from "@/components/ui/Icon";
import { ACCENT, ProportionBar } from "@/components/ui/stats";
import maxwidth from "@/styles/maxwidth.module.css";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

type TeamCard = {
  id: string;
  name: string;
  logo: string;
  titles: number;
  runnerUps: number;
  wins: number;
  losses: number;
  roster: string[];
};

const stats: { key: keyof TeamCard; label: string; icon: keyof typeof ICONS; color: string }[] = [
  { key: "titles", label: "Títulos", icon: "trophy", color: ACCENT.gold },
  { key: "runnerUps", label: "Vices", icon: "note-sticky", color: ACCENT.draw },
  { key: "wins", label: "Vitórias", icon: "circle-check", color: ACCENT.win },
  { key: "losses", label: "Derrotas", icon: "shield", color: ACCENT.loss },
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
      logo: (t.logo_url as string) ?? "",
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
      <div className="mb-4 flex w-full flex-col rounded-lg bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon name="shield" className="text-gold" />
          Times
        </h1>
        <span className="mt-1 text-faint">
          {teams.length > 0
            ? `${teams.length} times na Federação Rebug.`
            : "Os times da Federação Rebug."}
        </span>
      </div>

      {teams.length === 0 ? (
        <p className="mt-6 text-center text-faint">No teams registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <article key={t.id} className="flex flex-col rounded-lg bg-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-panel">
                  {t.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logo} alt={t.name} className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="shield" className="text-faint" />
                  )}
                </div>
                <h3 className="flex-1 text-lg font-bold tracking-tight">{t.name}</h3>
                {t.titles > 0 && (
                  <span className="shrink-0 rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-[#1a1a1e]">
                    {t.titles}× <Icon name="trophy" />
                  </span>
                )}
              </div>

              {/* Barra de proporção Vitórias / Derrotas */}
              <ProportionBar
                segments={[
                  { value: t.wins, color: ACCENT.win, title: "Vitórias" },
                  { value: t.losses, color: ACCENT.loss, title: "Derrotas" },
                ]}
              />
              <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide">
                <span className="text-win">Vitórias</span>
                <span className="text-loss">Derrotas</span>
              </div>

              {/* Grade de blocos de estatísticas */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {stats.map((s) => (
                  <div
                    key={s.key}
                    className="flex flex-col items-center rounded-md bg-panel py-2.5"
                  >
                    <Icon name={s.icon} className="text-xs" style={{ color: s.color }} />
                    <div className="text-base font-bold" style={{ color: s.color }}>
                      {t[s.key] as number}
                    </div>
                    <div className="text-[10px] text-faint">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Escalação */}
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Elenco ({t.roster.length})
                </div>
                {t.roster.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {t.roster.map((name) => (
                      <span
                        key={name}
                        className="rounded-md bg-panel px-2 py-0.5 text-xs"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-faint">Sem jogadores vinculados.</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
