import Icon from "@/components/ui/Icon";
import maxwidth from "@/styles/maxwidth.module.css";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";
import { matchFromRow, computeTopScorers, type Match } from "@/lib/tournaments";

export const dynamic = "force-dynamic";

type Tour = {
  id: string;
  name: string;
  status: string;
  teams: string[];
  matches: Match[];
  messages: { body: string }[];
};

const statusStyle: Record<string, string> = {
  "Em andamento": "bg-yellow-500 text-yellow-900",
  Finalizado: "bg-[#1d1d1d] text-[#cfcfcf] border border-[#454545]",
  "Em breve": "bg-blue-500 text-white",
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
      <div className="flex flex-col p-4 mb-4 w-full bg-[#2f2f2f] border border-[#454545] rounded-xl">
        <h1 className="text-xl font-bold">
          <Icon name="trophy" className="text-yellow-500 mr-2" />
          Torneios
        </h1>
        <span className="mt-1 text-[#cfcfcf]">Campeonatos da Federação Rebug.</span>
      </div>

      {tours.length === 0 ? (
        <p className="text-gray-400 mt-6 text-center">No tournaments registered yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {tours.map((t) => {
            const scorers = computeTopScorers(t.matches).slice(0, 10);
            return (
              <article key={t.id} className="rounded-xl bg-[#2f2f2f] border border-[#454545] p-5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-lg font-bold">{t.name}</h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      statusStyle[t.status] ?? "bg-[#1d1d1d] text-[#cfcfcf]"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                {t.teams.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-[#8d8d8d] mb-1">Times participantes</div>
                    <div className="flex flex-wrap gap-1">
                      {t.teams.map((n) => (
                        <span
                          key={n}
                          className="bg-[#1d1d1d] border border-[#454545] rounded-full px-2 py-0.5 text-xs"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  {/* Artilharia */}
                  <div className="bg-[#1d1d1d] rounded-lg p-3">
                    <h3 className="text-sm font-bold mb-2">
                      <Icon name="futbol" className="text-yellow-500 mr-1" />
                      Artilharia
                    </h3>
                    {scorers.length === 0 ? (
                      <p className="text-xs text-[#8d8d8d]">Sem gols registrados.</p>
                    ) : (
                      <ol className="text-sm flex flex-col gap-1">
                        {scorers.map((s, i) => (
                          <li key={s.playerId} className="flex justify-between">
                            <span>
                              <span className="text-[#8d8d8d] mr-2">{i + 1}</span>
                              {playerName.get(s.playerId) ?? s.playerId}
                            </span>
                            <span className="text-yellow-500 font-bold">{s.goals}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* Súmulas */}
                  <div className="bg-[#1d1d1d] rounded-lg p-3">
                    <h3 className="text-sm font-bold mb-2">
                      <Icon name="note-sticky" className="text-blue-400 mr-1" />
                      Súmulas
                    </h3>
                    {t.matches.length === 0 ? (
                      <p className="text-xs text-[#8d8d8d]">Nenhuma partida registrada.</p>
                    ) : (
                      <ul className="text-sm flex flex-col gap-1.5">
                        {t.matches.map((m, i) => (
                          <li key={m.id ?? i} className="flex items-center justify-between gap-2">
                            <span className="truncate">
                              {team(m.homeTeamId)}{" "}
                              <b className="text-yellow-500">
                                {m.homeScore}×{m.awayScore}
                              </b>{" "}
                              {team(m.awayTeamId)}
                            </span>
                            <span className="text-[#8d8d8d] text-xs shrink-0">{m.playedAt ?? ""}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Mensagens */}
                {t.messages.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-[#8d8d8d] mb-1">Mensagens</div>
                    <ul className="flex flex-col gap-2">
                      {t.messages.map((m, i) => (
                        <li
                          key={i}
                          className="bg-[#1d1d1d] border border-[#454545] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
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
