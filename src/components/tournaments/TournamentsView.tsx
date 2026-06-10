import Link from "next/link";
import Icon from "@/components/ui/Icon";
import maxwidth from "@/styles/maxwidth.module.css";
import { focusStyle } from "@/lib/imageFocus";
import { computeTopScorers } from "@/lib/tournaments";
import { statusStyle, type TournamentView } from "@/components/tournaments/shared";

export default function TournamentsView({
  tournaments,
  playerNames,
}: {
  tournaments: TournamentView[];
  playerNames: Record<string, string>;
}) {
  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      <div className="mb-4 flex w-full flex-col rounded-lg bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon name="trophy" className="text-gold" />
          Torneios
        </h1>
        <span className="mt-1 text-faint">
          {tournaments.length > 0
            ? "Campeonatos da Federação Rebug. Clique em um torneio para ver tudo."
            : "Campeonatos da Federação Rebug."}
        </span>
      </div>

      {tournaments.length === 0 ? (
        <p className="mt-6 text-center text-faint">No tournaments registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => {
            const topScorer = computeTopScorers(t.matches)[0];
            const hasLive = t.matches.some((m) => m.isLive);
            const dateLabel = t.date ? t.date.slice(0, 10).split("-").reverse().join("/") : null;
            return (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}`}
                className="group relative flex flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-white/5 transition-all duration-200 hover:-translate-y-1 hover:ring-gold/40 hover:shadow-[0_12px_30px_-12px_rgba(255,179,0,0.45)]"
              >
                {/* Banner */}
                <div className="relative h-32 w-full overflow-hidden bg-panel">
                  {t.banner ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.banner}
                      alt={t.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      style={focusStyle(t.banner)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-panel to-base">
                      <Icon name="trophy" className="text-4xl text-gold/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                  <span
                    className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-[11px] font-bold backdrop-blur-sm ${
                      statusStyle[t.status] ?? "bg-panel/80 text-faint"
                    }`}
                  >
                    {t.status}
                  </span>
                  {hasLive ? (
                    <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-md bg-loss px-2 py-0.5 text-[11px] font-bold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
                    </span>
                  ) : (
                    t.championName && (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-gold/90 px-2 py-0.5 text-[11px] font-bold text-[#1a1a1e] backdrop-blur-sm">
                        <Icon name="trophy" /> {t.championName}
                      </span>
                    )
                  )}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2">
                    {t.logo && (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-panel/80 ring-1 ring-white/15">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={t.logo} alt="" className="h-full w-full object-cover" style={focusStyle(t.logo)} />
                      </span>
                    )}
                    <h3 className="truncate text-lg font-extrabold tracking-tight text-shadow-lg">
                      {t.name}
                    </h3>
                  </div>
                </div>

                {/* Rodapé com métricas rápidas */}
                <div className="flex items-center gap-3 px-4 py-3 text-xs">
                  <span className="flex items-center gap-1 text-faint">
                    <Icon name="shield" className="text-draw" />
                    {t.teams.length} times
                  </span>
                  <span className="flex items-center gap-1 text-faint">
                    <Icon name="note-sticky" className="text-draw" />
                    {t.matches.length} jogos
                  </span>
                  {dateLabel && (
                    <span className="flex items-center gap-1 text-faint" title="Data da copa">
                      📅 {dateLabel}
                    </span>
                  )}
                  {topScorer && (
                    <span className="ml-auto flex items-center gap-1 truncate font-semibold text-gold">
                      <Icon name="futbol" />
                      {playerNames[topScorer.playerId] ?? topScorer.playerId} ({topScorer.goals})
                    </span>
                  )}
                </div>

                <div className="border-t border-white/5 px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-gold opacity-0 transition-opacity group-hover:opacity-100">
                  Ver torneio →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
