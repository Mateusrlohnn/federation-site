import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { ACCENT, PerfBar, ResultBlock } from "@/components/ui/stats";
import maxwidth from "@/styles/maxwidth.module.css";
import { avatarUrl } from "@/lib/hof";
import { POSITIONS, type Position } from "@/lib/teams";
import {
  computeTopScorers,
  computeTopAssists,
  goalTimeline,
  type Match,
} from "@/lib/tournaments";
import { statusStyle, type TourTeam } from "@/components/tournaments/shared";

/**
 * Tela completa de uma copa (rota /tournaments/[id]).
 * Base apresentacional: jogo ao vivo, últimos jogos, artilharia, líder de
 * assistências, top por posição (copa encerrada) e notícias. Apenas lê dados
 * já carregados — novas seções poderão ser adicionadas depois.
 */

export type ScreenData = {
  id: string;
  name: string;
  status: string;
  banner: string;
  championName: string | null;
  championTeamId: string | null;
  organizerName: string | null;
  teams: TourTeam[];
  matches: Match[];
  messages: { body: string }[];
  playerNames: Record<string, string>;
  playerPositions: Record<string, Position | null>;
  teamNames: Record<string, string>;
  teamLogos: Record<string, string>;
};

const MEDALS = ["#ffb300", "#c7ccd1", "#cd7f32"]; // ouro, prata, bronze

function SectionCard({
  icon,
  color,
  title,
  badge,
  children,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  color: string;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-card p-4 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
        <Icon name={icon} style={{ color }} />
        {title}
        {badge}
      </h2>
      {children}
    </section>
  );
}

function TeamBadge({
  name,
  logo,
  align = "left",
}: {
  name: string;
  logo?: string;
  align?: "left" | "right";
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-base">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="shield" className="text-faint" />
        )}
      </span>
      <span className="min-w-0 truncate font-bold">{name}</span>
    </div>
  );
}

export default function TournamentScreen({ data }: { data: ScreenData }) {
  const team = (id: string | null) => (id ? data.teamNames[id] ?? "—" : "—");
  const logo = (id: string | null) => (id ? data.teamLogos[id] ?? "" : "");
  const player = (id: string) => data.playerNames[id] ?? id;

  const live = data.matches.filter((m) => m.isLive);
  const recent = data.matches
    .filter((m) => !m.isLive)
    .sort((a, b) => (b.playedAt ?? "").localeCompare(a.playedAt ?? ""))
    .slice(0, 8);

  const scorers = computeTopScorers(data.matches).slice(0, 10);
  const maxGoals = scorers[0]?.goals ?? 0;
  const assists = computeTopAssists(data.matches).slice(0, 10);
  const maxAssists = assists[0]?.assists ?? 0;

  const finished = data.status === "Finalizado";
  // Top 3 por posição (por gols na copa), só quando encerrada.
  const allScorers = computeTopScorers(data.matches);
  const topByPosition = POSITIONS.map((pos) => ({
    pos,
    players: allScorers
      .filter((s) => data.playerPositions[s.playerId] === pos.key && s.goals > 0)
      .slice(0, 3),
  })).filter((g) => g.players.length > 0);

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      {/* Voltar */}
      <Link
        href="/tournaments"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-faint transition-colors hover:text-white"
      >
        ← Torneios
      </Link>

      {/* Banner / cabeçalho */}
      <div className="relative mb-4 h-48 w-full overflow-hidden rounded-xl bg-panel sm:h-60">
        {data.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.banner} alt={data.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-panel to-base">
            <Icon name="trophy" className="text-6xl text-gold/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-end justify-between gap-3 p-5">
          <div>
            {live.length > 0 && (
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-loss px-2 py-0.5 text-[11px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
              </span>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-shadow-lg sm:text-4xl">
              {data.name}
            </h1>
            {data.organizerName && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-faint text-shadow-lg">
                <Icon name="user" className="text-win" />
                Organizado por {data.organizerName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {data.championName && (
              <span className="flex items-center gap-1 rounded-md bg-gold px-2.5 py-1 text-xs font-bold text-[#1a1a1e]">
                <Icon name="trophy" /> {data.championName}
              </span>
            )}
            <span
              className={`rounded-md px-3 py-1 text-xs font-bold ${
                statusStyle[data.status] ?? "bg-panel text-faint"
              }`}
            >
              {data.status}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* JOGO AO VIVO */}
        {live.length > 0 && (
          <SectionCard
            icon="futbol"
            color={ACCENT.loss}
            title="Ao vivo"
            badge={
              <span className="flex items-center gap-1.5 rounded-md bg-loss px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> LIVE
              </span>
            }
          >
            <div className="flex flex-col gap-4">
              {live.map((m, i) => {
                const events = goalTimeline(m);
                return (
                  <div key={m.id ?? i} className="rounded-lg bg-panel p-4">
                    <div className="flex items-center gap-3">
                      <TeamBadge name={team(m.homeTeamId)} logo={logo(m.homeTeamId)} />
                      <div className="flex shrink-0 items-center gap-2 text-4xl font-extrabold tabular-nums">
                        <span>{m.homeScore}</span>
                        <span className="text-xl text-faint">×</span>
                        <span>{m.awayScore}</span>
                      </div>
                      <TeamBadge name={team(m.awayTeamId)} logo={logo(m.awayTeamId)} align="right" />
                    </div>

                    {events.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                        {events.map((e, j) => (
                          <span
                            key={j}
                            className="flex items-center gap-1.5 rounded-md bg-base py-0.5 pl-0.5 pr-2 text-sm"
                          >
                            <span className="flex h-6 w-5 items-end justify-center overflow-hidden rounded bg-panel">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={avatarUrl(player(e.playerId))}
                                alt=""
                                className="h-[30px] w-5 object-contain"
                              />
                            </span>
                            <Icon name="futbol" className="text-gold" />
                            <span className="font-semibold">{player(e.playerId)}</span>
                            {e.minute != null && (
                              <span className="font-mono text-xs text-faint">{e.minute}&apos;</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* ARTILHARIA + ASSISTÊNCIAS */}
        <div className="grid gap-4 md:grid-cols-2">
          <SectionCard icon="futbol" color={ACCENT.gold} title="Artilharia">
            {scorers.length === 0 ? (
              <p className="text-sm text-faint">Sem gols registrados.</p>
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
                        {player(s.playerId)}
                      </>
                    }
                    trailing={s.goals}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard icon="handshake-angle" color={ACCENT.draw} title="Líder de assistências">
            {assists.length === 0 ? (
              <p className="text-sm text-faint">Sem assistências registradas.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {assists.map((s, i) => (
                  <PerfBar
                    key={s.playerId}
                    value={s.assists}
                    max={maxAssists}
                    color={i === 0 ? ACCENT.draw : ACCENT.win}
                    label={
                      <>
                        <span className="mr-1.5 text-faint">{i + 1}</span>
                        {player(s.playerId)}
                      </>
                    }
                    trailing={s.assists}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ÚLTIMOS JOGOS */}
        <SectionCard icon="note-sticky" color={ACCENT.draw} title="Últimos jogos">
          {recent.length === 0 ? (
            <p className="text-sm text-faint">Nenhuma partida registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recent.map((m, i) => {
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
                    className="flex items-center gap-2 rounded-md bg-panel px-3 py-2 text-sm"
                  >
                    <span className="flex-1 truncate text-right font-medium">
                      {team(m.homeTeamId)}
                    </span>
                    <span className="flex shrink-0 flex-col items-center">
                      <span className="flex gap-1">
                        <ResultBlock value={m.homeScore} color={homeColor} />
                        <ResultBlock value={m.awayScore} color={awayColor} />
                      </span>
                      {m.playedAt && (
                        <span className="mt-0.5 text-[10px] text-faint">{m.playedAt}</span>
                      )}
                    </span>
                    <span className="flex-1 truncate font-medium">{team(m.awayTeamId)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        {/* TOP POR POSIÇÃO (copa encerrada) */}
        {finished && topByPosition.length > 0 && (
          <SectionCard icon="trophy" color={ACCENT.gold} title="Top por posição (gols)">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {topByPosition.map(({ pos, players }) => (
                <div key={pos.key} className="rounded-lg bg-panel p-3">
                  <div
                    className="mb-2 inline-flex items-center justify-center rounded-md bg-gold px-2 py-0.5 text-xs font-extrabold text-[#1a1a1e]"
                    title={pos.label}
                  >
                    {pos.sigla}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {players.map((s, i) => (
                      <li key={s.playerId} className="flex items-center gap-2">
                        <span
                          className="w-4 text-center font-mono text-sm font-bold"
                          style={{ color: MEDALS[i] ?? ACCENT.win }}
                        >
                          {i + 1}
                        </span>
                        <span className="flex h-7 w-5 shrink-0 items-end justify-center overflow-hidden rounded bg-base">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatarUrl(player(s.playerId))}
                            alt=""
                            className="h-[32px] w-5 object-contain"
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {player(s.playerId)}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-gold">{s.goals}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* NOTÍCIAS */}
        <SectionCard icon="envelope" color={ACCENT.win} title="Notícias da copa">
          {data.messages.length === 0 ? (
            <p className="text-sm text-faint">Sem notícias publicadas.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.messages.map((m, i) => (
                <li key={i} className="whitespace-pre-wrap rounded-md bg-panel px-3 py-2 text-sm">
                  {m.body}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
