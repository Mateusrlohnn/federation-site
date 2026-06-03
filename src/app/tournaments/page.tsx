import Icon from "@/components/ui/Icon";
import { ACCENT, PerfBar, ResultBlock } from "@/components/ui/stats";
import maxwidth from "@/styles/maxwidth.module.css";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";
import { matchFromRow, computeTopScorers, type Match } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type Tour = {
  id: string;
  name: string;
  status: string;
  image: string;
  teams: string[];
  matches: Match[];
  messages: { body: string }[];
};

const statusStyle: Record<string, string> = {
  "Em andamento": "bg-gold text-[#1a1a1e]",
  Finalizado: "bg-win text-[#0a1f10]",
  "Em breve": "bg-draw text-white",
};

async function getData() {
  const empty = { tours: [] as Tour[], playerName: new Map<string, string>(), teamName: new Map<string, string>() };
  if (!supabaseConfigured) return empty;
  try {
    const supabase = publicClient();
    const [t, p, te] = await Promise.all([
      supabase
        .from("tournaments")
        .select(
          "*, tournament_teams(teams(name)), matches(*, match_goals(player_id, goals)), tournament_messages(body)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("players").select("id, name"),
      supabase.from("teams").select("id, name"),
    ]);
    const playerName = new Map<string, string>(
      ((p.data as { id: string; name: string }[]) ?? []).map((x) => [x.id, x.name]),
    );
    const teamName = new Map<string, string>(
      ((te.data as { id: string; name: string }[]) ?? []).map((x) => [x.id, x.name]),
    );
    if (t.error || !t.data) return { ...empty, playerName, teamName };
    const tours: Tour[] = t.data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: String(r.name),
      status: String(r.status),
      image: (r.image_url as string) ?? "",
      teams: ((r.tournament_teams as { teams: { name: string } | null }[]) ?? [])
        .map((x) => x.teams?.name)
        .filter(Boolean) as string[],
      matches: ((r.matches as Record<string, unknown>[]) ?? []).map(matchFromRow),
      messages: (r.tournament_messages as { body: string }[]) ?? [],
    }));
    return { tours, playerName, teamName };
  } catch {
    return empty;
  }
}

export default async function TournamentsPage() {
  const { tours, playerName, teamName } = await getData();
  const team = (id: string | null) => (id ? teamName.get(id) ?? "—" : "—");

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      <div className="mb-4 flex w-full flex-col rounded-lg bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon name="trophy" className="text-gold" />
          Torneios
        </h1>
        <span className="mt-1 text-faint">Campeonatos da Federação Rebug.</span>
      </div>

      {tours.length === 0 ? (
        <p className="mt-6 text-center text-faint">No tournaments registered yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {tours.map((t) => {
            const scorers = computeTopScorers(t.matches).slice(0, 10);
            const maxGoals = scorers[0]?.goals ?? 0;
            return (
              <article key={t.id} className="rounded-lg bg-card p-5">
                <div className="flex flex-wrap items-center gap-3">
                  {t.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.image}
                      alt={t.name}
                      className="h-12 w-12 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <h2 className="flex-1 text-lg font-bold tracking-tight">{t.name}</h2>
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-bold ${
                      statusStyle[t.status] ?? "bg-panel text-faint"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                {t.teams.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                      Times participantes
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.teams.map((n) => (
                        <span
                          key={n}
                          className="rounded-md bg-panel px-2 py-0.5 text-xs"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {/* Artilharia — barras de performance */}
                  <div className="rounded-md bg-panel p-3">
                    <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold">
                      <Icon name="futbol" className="text-gold" />
                      Artilharia
                    </h3>
                    {scorers.length === 0 ? (
                      <p className="text-xs text-faint">Sem gols registrados.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {scorers.map((s, i) => (
                          <PerfBar
                            key={s.playerId}
                            value={s.goals}
                            max={maxGoals}
                            color={i === 0 ? ACCENT.gold : ACCENT.win}
                            label={
                              <>
                                <span className="mr-1.5 text-faint">{i + 1}</span>
                                {playerName.get(s.playerId) ?? s.playerId}
                              </>
                            }
                            trailing={s.goals}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Súmulas — tabela de histórico plana com blocos de resultado */}
                  <div className="rounded-md bg-panel p-3">
                    <h3 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold">
                      <Icon name="note-sticky" className="text-draw" />
                      Súmulas
                    </h3>
                    {t.matches.length === 0 ? (
                      <p className="text-xs text-faint">Nenhuma partida registrada.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {t.matches.map((m, i) => {
                          const homeColor =
                            m.homeScore > m.awayScore
                              ? ACCENT.win
                              : m.homeScore < m.awayScore
                                ? ACCENT.loss
                                : ACCENT.draw;
                          const awayColor =
                            m.awayScore > m.homeScore
                              ? ACCENT.win
                              : m.awayScore < m.homeScore
                                ? ACCENT.loss
                                : ACCENT.draw;
                          return (
                            <li
                              key={m.id ?? i}
                              className="flex items-center gap-2 rounded-md bg-card px-2.5 py-1.5 text-sm"
                            >
                              <span className="flex-1 truncate text-right">{team(m.homeTeamId)}</span>
                              <span className="flex shrink-0 flex-col items-center">
                                <span className="flex gap-1">
                                  <ResultBlock value={m.homeScore} color={homeColor} />
                                  <ResultBlock value={m.awayScore} color={awayColor} />
                                </span>
                                {m.playedAt && (
                                  <span className="mt-0.5 text-[10px] text-faint">{m.playedAt}</span>
                                )}
                              </span>
                              <span className="flex-1 truncate">{team(m.awayTeamId)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Mensagens */}
                {t.messages.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                      Mensagens
                    </div>
                    <ul className="flex flex-col gap-2">
                      {t.messages.map((m, i) => (
                        <li
                          key={i}
                          className="whitespace-pre-wrap rounded-md bg-panel px-3 py-2 text-sm"
                        >
                          {m.body}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
