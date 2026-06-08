import Icon from "@/components/ui/Icon";
import { ACCENT } from "@/components/ui/stats";
import { focusStyle } from "@/lib/imageFocus";
import type { TourTeam } from "@/components/tournaments/shared";
import {
  computeStandings,
  splitGroups,
  buildKnockout,
  buildLibertadoresKnockout,
  nextPowerOfTwo,
  roundRobinFixtures,
  type FixtureRound,
  computeSwissRecords,
  swissTemplate,
  swissMatchesByRecord,
  swissThresholds,
  BYE,
  type TournamentFormat,
  type StandingRow,
  type BracketRound,
  type BracketMatch,
  type SwissNode,
  type MatchLike,
} from "@/lib/formats";
import {
  buildWindCupFromMatches,
  windCupStandings,
  windCupLeagueMatches,
  type WindTie,
  type WindCupResult,
} from "@/lib/windCup";

/**
 * Renderiza a estrutura do campeonato conforme o formato:
 * - pontos_corridos / grupos -> tabela(s) densas (estilo tabela-brasileirão)
 * - mata_mata / grupos       -> chave (bracket) estilo mata-mata
 * - suico                    -> fluxo de potes por recorde (estilo modelo suíço)
 * Tudo derivado dos resultados (atualiza em tempo real a cada jogo computado).
 */

type TeamLite = TourTeam;

function TeamCell({ team, small = false }: { team: TeamLite | undefined; small?: boolean }) {
  const s = small ? "h-5 w-5" : "h-6 w-6";
  return (
    <span className="flex items-center gap-2">
      <span className={`flex ${s} shrink-0 items-center justify-center overflow-hidden rounded bg-base`}>
        {team?.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logo} alt="" className="h-full w-full object-cover" style={focusStyle(team.logo)} />
        ) : (
          <Icon name="shield" className="text-[10px] text-faint" />
        )}
      </span>
      <span className="truncate">{team?.name ?? "—"}</span>
    </span>
  );
}

/** Cor da faixa de posição (zona de classificação). */
function zoneColor(pos: number, qualify: number): string {
  if (pos <= qualify) return ACCENT.win;
  return "transparent";
}

// ---- TABELA DE CLASSIFICAÇÃO (estilo tabela-brasileirão) ----
function StandingsTable({
  rows,
  byId,
  qualify = 4,
  zoneColorOf,
}: {
  rows: StandingRow[];
  byId: Map<string, TeamLite>;
  qualify?: number;
  zoneColorOf?: (pos: number) => string; // sobrepõe a zona padrão (ex.: Wind Cup)
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-faint">
            <tr>
              <th className="py-2.5 pl-3 pr-1 font-semibold">#</th>
              <th className="px-2 py-2.5 font-semibold">Time</th>
              <th className="px-2 py-2.5 text-center font-semibold text-white">Pts</th>
              <th className="px-2 py-2.5 text-center font-semibold">J</th>
              <th className="px-2 py-2.5 text-center font-semibold">V</th>
              <th className="px-2 py-2.5 text-center font-semibold">E</th>
              <th className="px-2 py-2.5 text-center font-semibold">D</th>
              <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">GM</th>
              <th className="hidden px-2 py-2.5 text-center font-semibold sm:table-cell">GC</th>
              <th className="px-2 py-2.5 pr-3 text-center font-semibold">SG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pos = i + 1;
              return (
                <tr
                  key={r.teamId}
                  className={`border-b border-white/5 last:border-0 ${i % 2 ? "bg-panel/20" : ""}`}
                >
                  <td className="py-2 pl-0 pr-1">
                    <span className="flex items-center">
                      <span
                        className="mr-2 h-6 w-1 rounded-full"
                        style={{ backgroundColor: zoneColorOf ? zoneColorOf(pos) : zoneColor(pos, qualify) }}
                      />
                      <span className="font-mono text-sm font-bold text-faint">{pos}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 font-semibold">
                    <TeamCell team={byId.get(r.teamId)} />
                  </td>
                  <td className="px-2 py-2 text-center text-base font-extrabold text-gold">
                    {r.points}
                  </td>
                  <td className="px-2 py-2 text-center text-faint">{r.played}</td>
                  <td className="px-2 py-2 text-center text-win">{r.wins}</td>
                  <td className="px-2 py-2 text-center text-faint">{r.draws}</td>
                  <td className="px-2 py-2 text-center text-loss">{r.losses}</td>
                  <td className="hidden px-2 py-2 text-center text-faint sm:table-cell">
                    {r.goalsFor}
                  </td>
                  <td className="hidden px-2 py-2 text-center text-faint sm:table-cell">
                    {r.goalsAgainst}
                  </td>
                  <td
                    className="px-2 py-2 pr-3 text-center font-mono font-semibold"
                    style={{ color: r.goalDiff > 0 ? ACCENT.win : r.goalDiff < 0 ? ACCENT.loss : undefined }}
                  >
                    {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- JOGOS POR RODADA (Rodada 1, 2, ...) — placar nulo = ainda não jogado ----
function FixturesByRound({
  rounds,
  byId,
  title = "Jogos por rodada",
}: {
  rounds: FixtureRound[];
  byId: Map<string, TeamLite>;
  title?: string;
}) {
  if (rounds.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rounds.map((r) => (
          <div key={r.label} className="rounded-lg bg-card p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gold">
              {r.label}
            </div>
            <ul className="flex flex-col gap-1">
              {r.matches.map((m, i) => {
                const played = m.homeScore != null && m.awayScore != null;
                const homeWin = played && (m.homeScore as number) > (m.awayScore as number);
                const awayWin = played && (m.awayScore as number) > (m.homeScore as number);
                return (
                  <li key={i} className="flex items-center gap-2 rounded-md bg-panel px-2 py-1.5 text-xs">
                    <span className={`min-w-0 flex-1 truncate text-right ${homeWin ? "font-bold text-white" : ""}`}>
                      {byId.get(m.home)?.name ?? "—"}
                    </span>
                    <span className="shrink-0 font-mono font-bold tabular-nums">
                      {played ? (
                        <>
                          <span style={{ color: homeWin ? ACCENT.win : undefined }}>{m.homeScore}</span>
                          <span className="mx-0.5 text-faint">×</span>
                          <span style={{ color: awayWin ? ACCENT.win : undefined }}>{m.awayScore}</span>
                        </>
                      ) : (
                        <span className="rounded bg-base px-1.5 py-0.5 text-[10px] text-faint">vs</span>
                      )}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${awayWin ? "font-bold text-white" : ""}`}>
                      {byId.get(m.away)?.name ?? "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function slotName(slot: string | null, byId: Map<string, TeamLite>): string {
  if (slot === BYE) return "Folga";
  if (!slot) return "A definir";
  return byId.get(slot)?.name ?? "—";
}
function slotLogo(slot: string | null, byId: Map<string, TeamLite>): string {
  if (!slot || slot === BYE) return "";
  return byId.get(slot)?.logo ?? "";
}

// ---- Bloco de confronto (reutilizado por mata-mata e suíço) ----
function MatchBox({ m, byId }: { m: BracketMatch; byId: Map<string, TeamLite> }) {
  const homeWin = m.winner && m.winner === m.home;
  const awayWin = m.winner && m.winner === m.away;
  // disputa de pênaltis: tempo normal empatado e há cobranças registradas
  const byPens =
    m.homeScore != null &&
    m.awayScore != null &&
    m.homeScore === m.awayScore &&
    ((m.homePens ?? 0) > 0 || (m.awayPens ?? 0) > 0);
  return (
    <div
      className="overflow-hidden rounded-lg bg-panel ring-1 ring-white/10"
      style={{ boxShadow: "0 6px 16px -10px rgba(0,0,0,0.6)" }}
    >
      {[
        { slot: m.home, score: m.homeScore, pens: m.homePens, win: homeWin },
        { slot: m.away, score: m.awayScore, pens: m.awayPens, win: awayWin },
      ].map((s, si) => (
        <div
          key={si}
          className={`flex items-center gap-2 px-2.5 py-2 text-sm ${
            si === 0 ? "border-b border-white/5" : ""
          } ${s.win ? "bg-gold/15 font-bold" : ""}`}
          style={s.win ? { boxShadow: `inset 3px 0 0 0 ${ACCENT.gold}` } : undefined}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-base">
            {slotLogo(s.slot, byId) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slotLogo(s.slot, byId)}
                alt=""
                className="h-full w-full object-cover"
                style={focusStyle(slotLogo(s.slot, byId))}
              />
            ) : (
              <Icon name="shield" className="text-[9px] text-faint" />
            )}
          </span>
          <span
            className={`min-w-0 flex-1 truncate ${s.slot === BYE || !s.slot ? "text-faint" : ""}`}
          >
            {slotName(s.slot, byId)}
          </span>
          <span className="shrink-0 font-mono tabular-nums">
            {s.score != null ? s.score : ""}
            {byPens && s.pens != null && (
              <span className="ml-1 text-[10px] text-faint" title="Disputa de pênaltis">
                ({s.pens})
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---- CHAVE / MATA-MATA (estilo mata-mata.jpg) ----
function Bracket({
  rounds,
  byId,
  compact = false,
}: {
  rounds: BracketRound[];
  byId: Map<string, TeamLite>;
  compact?: boolean;
}) {
  if (rounds.length === 0)
    return <p className="text-sm text-faint">Times insuficientes para a chave.</p>;
  return (
    <div className={`flex pb-1 ${compact ? "gap-2" : "gap-3 overflow-x-auto sm:gap-5"}`}>
      {rounds.map((round, ri) => (
        <div key={ri} className={`flex flex-col ${compact ? "min-w-[140px]" : "min-w-[190px] flex-1"}`}>
          <h3 className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-gold">
            {round.label}
          </h3>
          <div className="flex flex-1 flex-col justify-around gap-3">
            {round.matches.map((m, mi) => (
              <MatchBox key={mi} m={m} byId={byId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- FASE DE GRUPOS (cards estilo fase-grupos.jpg) ----
function buildGroups(teams: TeamLite[], groupCount: number | null) {
  const labeled = teams.filter((t) => t.group);
  if (labeled.length > 0) {
    const map = new Map<string, TeamLite[]>();
    for (const t of teams) {
      const key = t.group ?? "Sem grupo";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, ts]) => ({ label, teamIds: ts.map((t) => t.id) }));
  }
  return splitGroups(teams.map((t) => t.id), groupCount ?? undefined);
}

// Nó (pote) do template suíço, com setas indicadoras de vitória/derrota.
function SwissNodeCard({
  node,
  teamsHere,
  matchesHere,
  byId,
  qualifyWins,
  eliminateLosses,
}: {
  node: SwissNode;
  teamsHere: TeamLite[];
  matchesHere: BracketMatch[];
  byId: Map<string, TeamLite>;
  qualifyWins: number;
  eliminateLosses: number;
}) {
  const winTarget = `${node.wins + 1}-${node.losses}`;
  const lossTarget = `${node.wins}-${node.losses + 1}`;
  const winClassifies = node.wins + 1 >= qualifyWins;
  const lossEliminates = node.losses + 1 >= eliminateLosses;
  return (
    <div className="w-[150px] rounded-lg bg-panel/70 p-2 ring-1 ring-draw/30">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-extrabold tracking-wide text-draw">{node.record}</span>
        <span className="text-[9px] text-faint">{node.teams} times</span>
      </div>
      <div className="mb-1.5 flex flex-col gap-1">
        {matchesHere.length > 0 ? (
          matchesHere.map((m, mi) => <MatchBox key={mi} m={m} byId={byId} />)
        ) : teamsHere.length === 0 ? (
          <span className="rounded bg-base px-1.5 py-0.5 text-[10px] text-faint">aguardando…</span>
        ) : (
          teamsHere.map((t) => (
            <div key={t.id} className="rounded bg-base px-1.5 py-0.5 text-[11px] font-semibold">
              <TeamCell team={t} small />
            </div>
          ))
        )}
      </div>
      {/* setas indicadoras */}
      <div className="flex flex-col gap-0.5 border-t border-white/5 pt-1 text-[9px] font-bold leading-tight">
        <span style={{ color: ACCENT.win }}>
          ↑ vence → {winTarget}
          {winClassifies && " · Classifica ★"}
        </span>
        <span style={{ color: ACCENT.loss }}>
          ↓ perde → {lossTarget}
          {lossEliminates && " · Eliminado ✕"}
        </span>
      </div>
    </div>
  );
}

// Caixa de desfecho do suíço (semifinalistas / eliminados).
function OutcomeBox({
  title,
  ids,
  color,
  byId,
}: {
  title: string;
  ids: string[];
  color: string;
  byId: Map<string, TeamLite>;
}) {
  return (
    <div
      className="min-w-[170px] rounded-xl p-3"
      style={{ backgroundColor: `${color}14`, boxShadow: `inset 0 0 0 1px ${color}55` }}
    >
      <div
        className="mb-2 text-center text-[11px] font-extrabold uppercase tracking-wider"
        style={{ color }}
      >
        {title}
      </div>
      {ids.length === 0 ? (
        <p className="text-center text-[11px] text-faint">—</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {ids.map((id) => (
            <div key={id} className="rounded-md bg-base px-2 py-1 text-xs font-semibold">
              <TeamCell team={byId.get(id)} small />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- WIND CUP — caixa de confronto do bracket (com pênaltis) ----
function WindTieBox({ tie, byId }: { tie: WindTie; byId: Map<string, TeamLite> }) {
  const rows = [
    { id: tie.home, score: tie.homeScore, pens: tie.homePens, win: tie.winner != null && tie.winner === tie.home },
    { id: tie.away, score: tie.awayScore, pens: tie.awayPens, win: tie.winner != null && tie.winner === tie.away },
  ];
  return (
    <div className="overflow-hidden rounded-lg bg-panel ring-1 ring-white/10">
      {rows.map((s, si) => (
        <div
          key={si}
          className={`flex items-center gap-2 px-2.5 py-2 text-sm ${
            si === 0 ? "border-b border-white/5" : ""
          } ${s.win ? "bg-gold/15 font-bold" : ""}`}
          style={s.win ? { boxShadow: `inset 3px 0 0 0 ${ACCENT.gold}` } : undefined}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded bg-base">
            {slotLogo(s.id, byId) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={slotLogo(s.id, byId)}
                alt=""
                className="h-full w-full object-cover"
                style={focusStyle(slotLogo(s.id, byId))}
              />
            ) : (
              <Icon name="shield" className="text-[9px] text-faint" />
            )}
          </span>
          <span className={`min-w-0 flex-1 truncate ${!s.id ? "text-faint" : ""}`}>
            {slotName(s.id, byId)}
          </span>
          {s.pens != null && (
            <span className="shrink-0 font-mono text-[11px] text-draw">({s.pens})</span>
          )}
          <span className="shrink-0 font-mono tabular-nums">{s.score != null ? s.score : ""}</span>
        </div>
      ))}
    </div>
  );
}

// ---- WIND CUP — coluna do bracket com rótulo e legenda do fluxo ----
function WindColumn({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[180px] flex-col justify-center gap-2">
      <span className="text-center text-[10px] font-bold uppercase tracking-wide text-gold">
        {label}
      </span>
      <div className="flex flex-col gap-2">{children}</div>
      {caption && <span className="text-center text-[9px] leading-tight text-faint">{caption}</span>}
    </div>
  );
}

// ---- WIND CUP — classificação (zonas) + bracket Upper/Lower/Semi/Final ----
function WindCupView({
  result,
  standings,
  games,
  byId,
}: {
  result: WindCupResult;
  standings: StandingRow[];
  games: MatchLike[];
  byId: Map<string, TeamLite>;
}) {
  const { seeding, ties } = result;
  const names = (ids: string[]) => ids.map((id) => byId.get(id)?.name ?? "—").join(", ") || "—";
  const finalistName = result.finalist ? byId.get(result.finalist)?.name ?? "—" : "—";
  const upper = seeding.filter((s) => s.role === "upper1").map((s) => s.teamId);
  const lower = seeding.filter((s) => s.role === "lower1").map((s) => s.teamId);
  const championName = result.champion ? byId.get(result.champion)?.name ?? "—" : null;

  // Zona da classificação: 1º ouro, 2-3 verde (Upper), 4-5 laranja (Lower), 6-8 vermelho.
  const zoneColorOf = (pos: number) =>
    pos === 1 ? ACCENT.gold : pos <= 3 ? ACCENT.win : pos <= 5 ? ACCENT.draw : ACCENT.loss;

  return (
    <div className="flex flex-col gap-6">
      {/* Classificação da fase de pontos */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">
          Fase de pontos — turno único (7 jogos por time)
        </h3>
        <StandingsTable rows={standings} byId={byId} zoneColorOf={zoneColorOf} />
      </div>

      {/* Zonas de classificação para a eliminatória */}
      <div className="grid gap-2 sm:grid-cols-4">
        {[
          { t: "🏁 Finalista (1º)", v: finalistName, c: ACCENT.gold },
          { t: "Upper 1 (2º · 3º)", v: names(upper), c: ACCENT.win },
          { t: "Lower 1 (4º · 5º)", v: names(lower), c: ACCENT.draw },
          { t: "Rebaixados (6º–8º)", v: names(result.relegated), c: ACCENT.loss },
        ].map((z) => (
          <div
            key={z.t}
            className="rounded-lg p-3"
            style={{ backgroundColor: `${z.c}14`, boxShadow: `inset 0 0 0 1px ${z.c}55` }}
          >
            <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ color: z.c }}>
              {z.t}
            </div>
            <div className="mt-1 text-sm font-semibold">{z.v}</div>
          </div>
        ))}
      </div>

      {/* Bracket Upper / Lower / Semi / Final */}
      <div>
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">
          Fase eliminatória
        </h3>
        <div className="overflow-x-auto pb-1">
          <div className="mx-auto flex w-max items-stretch gap-2 sm:gap-4">
          <WindColumn label="Mata-mata inicial">
            <WindTieBox tie={ties.upper1} byId={byId} />
            <span className="text-center text-[9px] leading-tight text-faint">
              Upper 1 · vencedor → Semi · perdedor → Lower 2
            </span>
            <WindTieBox tie={ties.lower1} byId={byId} />
            <span className="text-center text-[9px] leading-tight text-faint">
              Lower 1 · vencedor → Lower 2 · perdedor fora
            </span>
          </WindColumn>
          <span className="self-center text-lg text-faint">→</span>
          <WindColumn label="Lower 2" caption="vencedor → Semi · perdedor fora (suporta pênaltis)">
            <WindTieBox tie={ties.lower2} byId={byId} />
          </WindColumn>
          <span className="self-center text-lg text-faint">→</span>
          <WindColumn label="Semi-Final" caption="vencedor → Grande Final · perdedor fora">
            <WindTieBox tie={ties.semi} byId={byId} />
          </WindColumn>
          <span className="self-center text-lg text-faint">→</span>
          <WindColumn label="Grande Final" caption="1º da fase de pontos vs vencedor da Semi">
            <WindTieBox tie={ties.final} byId={byId} />
            {championName && (
              <div className="mt-1 rounded-md bg-gold px-2 py-1 text-center text-xs font-extrabold text-[#1a1a1e]">
                🏆 {championName}
              </div>
            )}
          </WindColumn>
          </div>
        </div>
      </div>

      {/* Jogos da fase de pontos — confrontos livres lançados pelo admin (sem rodadas fixas) */}
      <div>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-faint">
          Fase de pontos — jogos
        </h3>
        <p className="mb-2 text-[11px] text-faint">
          Sem rodadas obrigatórias: os confrontos são marcados livremente pelo admin.
        </p>
        {games.length === 0 ? (
          <p className="rounded-lg bg-panel/50 p-3 text-sm text-faint">
            Nenhum jogo da fase de pontos lançado ainda.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((m, i) => {
              const home = m.homeTeamId as string;
              const away = m.awayTeamId as string;
              const homeWin = m.homeScore > m.awayScore;
              const awayWin = m.awayScore > m.homeScore;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md bg-panel px-2.5 py-2 text-xs"
                >
                  <span className={`min-w-0 flex-1 truncate text-right ${homeWin ? "font-bold text-white" : ""}`}>
                    {byId.get(home)?.name ?? "—"}
                  </span>
                  <span className="shrink-0 font-mono font-bold tabular-nums">
                    <span style={{ color: homeWin ? ACCENT.win : undefined }}>{m.homeScore}</span>
                    <span className="mx-0.5 text-faint">×</span>
                    <span style={{ color: awayWin ? ACCENT.win : undefined }}>{m.awayScore}</span>
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${awayWin ? "font-bold text-white" : ""}`}>
                    {byId.get(away)?.name ?? "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FormatView({
  format,
  teams,
  matches,
  groupCount = null,
}: {
  format: TournamentFormat;
  teams: TeamLite[];
  matches: MatchLike[];
  groupCount?: number | null;
}) {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const teamIds = teams.map((t) => t.id);

  if (teamIds.length < 2) {
    return (
      <p className="rounded-lg bg-panel/50 p-4 text-sm text-faint">
        Vincule ao menos 2 times ao campeonato para gerar a tabela/chave.
      </p>
    );
  }

  // ---- PONTOS CORRIDOS ----
  if (format === "pontos_corridos") {
    return (
      <div className="flex flex-col gap-6">
        <StandingsTable rows={computeStandings(teamIds, matches)} byId={byId} />
        <FixturesByRound rounds={roundRobinFixtures(teamIds, matches)} byId={byId} />
      </div>
    );
  }

  // ---- FASE DE GRUPOS + MATA-MATA ----
  if (format === "grupos_mata_mata") {
    const groups = buildGroups(teams, groupCount);
    const firsts: string[] = [];
    const seconds: string[] = [];
    for (const g of groups) {
      const s = computeStandings(g.teamIds, matches);
      if (s[0]) firsts.push(s[0].teamId);
      if (s[1]) seconds.push(s[1].teamId);
    }
    const seeds = [...firsts, ...seconds];
    const knockout = seeds.length >= 2 ? buildKnockout(seeds, matches) : [];
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g.label} className="overflow-hidden rounded-lg bg-card ring-1 ring-white/5">
              <div className="bg-gradient-to-r from-gold/20 to-transparent px-3 py-2 text-sm font-extrabold uppercase tracking-wide">
                {g.label}
              </div>
              <StandingsTable
                rows={computeStandings(g.teamIds, matches)}
                byId={byId}
                qualify={2}
              />
            </div>
          ))}
        </div>
        {/* jogos por rodada de cada grupo */}
        {groups.map((g) => (
          <FixturesByRound
            key={`fix-${g.label}`}
            rounds={roundRobinFixtures(g.teamIds, matches)}
            byId={byId}
            title={`${g.label} — jogos por rodada`}
          />
        ))}
        {knockout.length > 0 && (
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-faint">
              Mata-mata — 2 melhores de cada grupo
            </h3>
            <Bracket rounds={knockout} byId={byId} />
          </div>
        )}
      </div>
    );
  }

  // ---- MATA-MATA ----
  if (format === "mata_mata") {
    // semeadura: ordem do sorteio (teams já vêm ordenados por seed); senão classificação
    const standings = computeStandings(teamIds, matches);
    const seeded =
      teams.some((t) => t.seed != null)
        ? teamIds
        : standings.some((r) => r.played > 0)
          ? standings.map((r) => r.teamId)
          : teamIds;
    return <Bracket rounds={buildKnockout(seeded, matches)} byId={byId} />;
  }

  // ---- WIND CUP (fase de pontos + bracket Upper/Lower/Semi/Final) ----
  if (format === "wind_cup") {
    // semeadura pela classificação da liga; se ainda não há jogos, usa a ordem do sorteio/vínculo.
    const standings = windCupStandings(teamIds, matches);
    const ordered = standings.some((r) => r.played > 0) ? standings.map((r) => r.teamId) : teamIds;
    const result = buildWindCupFromMatches(ordered, matches);
    return (
      <WindCupView
        result={result}
        standings={standings}
        games={windCupLeagueMatches(matches)}
        byId={byId}
      />
    );
  }

  // ---- GRUPOS + MATA-MATA (LIBERTADORES): 1º à semi; 2º e 3º nas quartas ----
  if (format === "libertadores") {
    const groups = buildGroups(teams, groupCount);
    const standingsByGroup = groups.map((g) => computeStandings(g.teamIds, matches));
    const knockout = buildLibertadoresKnockout(
      standingsByGroup.map((s) => s.map((r) => r.teamId)),
      matches,
    );
    // 1º (gold) vai direto à semi; 2º e 3º (azul) disputam as quartas.
    const libZone = (pos: number) =>
      pos === 1 ? ACCENT.gold : pos <= 3 ? ACCENT.draw : "transparent";
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g, gi) => (
            <div key={g.label} className="overflow-hidden rounded-lg bg-card ring-1 ring-white/5">
              <div className="bg-gradient-to-r from-gold/20 to-transparent px-3 py-2 text-sm font-extrabold uppercase tracking-wide">
                {g.label}
              </div>
              <StandingsTable rows={standingsByGroup[gi]} byId={byId} zoneColorOf={libZone} />
            </div>
          ))}
        </div>
        {/* legenda das zonas de classificação */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ACCENT.gold }} />
            <b className="text-white">1º colocado</b> — vaga direta na semifinal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ACCENT.draw }} />
            <b className="text-white">2º e 3º</b> — disputam as quartas de final
          </span>
        </div>
        {knockout.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-faint">Mata-mata</h3>
            <p className="mb-3 text-xs text-faint">
              Os <b className="text-white">1º colocados</b> de cada grupo avançam direto à{" "}
              <b className="text-white">semifinal</b>. Os <b className="text-white">2º e 3º</b> entram
              nas <b className="text-white">quartas</b> (cruzado entre grupos: 2ºG1 × 3ºG2 e
              2ºG2 × 3ºG1); os vencedores enfrentam os 1º nas semis.
            </p>
            <Bracket rounds={knockout} byId={byId} />
          </div>
        )}
      </div>
    );
  }

  // ---- SISTEMA SUÍÇO (template de possibilidades + setas — estilo modelo suíço) ----
  const records = computeSwissRecords(teamIds, matches);
  const { qualifyWins, eliminateLosses, rounds } = swissThresholds(teamIds.length);
  const template = swissTemplate(teamIds.length);
  const matchesByRecord = swissMatchesByRecord(teamIds, matches);

  // times atualmente em cada recorde "V-D"
  const teamsByRecord = new Map<string, TeamLite[]>();
  for (const r of records) {
    const k = `${r.wins}-${r.losses}`;
    if (!teamsByRecord.has(k)) teamsByRecord.set(k, []);
    const t = byId.get(r.teamId);
    if (t) teamsByRecord.get(k)!.push(t);
  }
  const classifiedIds = records.filter((r) => r.status === "Classificado").map((r) => r.teamId);
  const eliminatedIds = records.filter((r) => r.status === "Eliminado").map((r) => r.teamId);

  // colunas: apenas nós "ativos" por rodada (os desfechos vão nas caixas à direita)
  const activeCols = template.byRound
    .map((col) => col.filter((n) => n.kind === "active"))
    .filter((col) => col.length > 0);

  // fase final: os classificados (2-0 e 2-1) vão para Semifinais → Final.
  // mostra a chave SEMPRE (pré-visualizada), com "A definir" nas vagas ainda
  // não preenchidas; vai completando conforme os times classificam.
  const classifiedCapacity = template.byRound
    .flat()
    .filter((n) => n.kind === "classified")
    .reduce((s, n) => s + n.teams, 0);
  const finalSize = Math.max(2, nextPowerOfTwo(classifiedCapacity || 2));
  const finalBracket = buildKnockout(classifiedIds, matches, { size: finalSize, fillEmpty: "tbd" });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-faint">
        Sistema suíço · {rounds} rodadas · classifica com <b className="text-win">{qualifyWins}V</b>,
        elimina com <b className="text-loss">{eliminateLosses}D</b>.
      </p>

      {/* PRÉ-VISUALIZAÇÃO DO CHAVEAMENTO (potes + setas → fase final) — sem scroll */}
      <div className="flex flex-wrap items-stretch justify-center gap-1.5">
        {activeCols.map((col, ci) => (
          <div key={ci} className="flex items-center gap-1.5">
            <div className="flex flex-col justify-center gap-2">
              <span className="text-center text-[10px] font-bold uppercase tracking-wide text-faint">
                Rodada {ci + 1}
              </span>
              {col.map((node) => (
                <SwissNodeCard
                  key={node.record}
                  node={node}
                  teamsHere={teamsByRecord.get(node.record) ?? []}
                  matchesHere={matchesByRecord.get(node.record) ?? []}
                  byId={byId}
                  qualifyWins={qualifyWins}
                  eliminateLosses={eliminateLosses}
                />
              ))}
            </div>
            <span className="self-center text-lg text-faint">→</span>
          </div>
        ))}

        {/* FASE FINAL inline — ao lado da última rodada */}
        <div className="flex flex-col justify-center">
          <span className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-gold">
            Fase final
          </span>
          <Bracket rounds={finalBracket} byId={byId} compact />
        </div>

        {/* eliminados (compacto) */}
        <div className="flex flex-col justify-center">
          <OutcomeBox title="✕ Eliminados" ids={eliminatedIds} color={ACCENT.loss} byId={byId} />
        </div>
      </div>

      {/* DOCUMENTAÇÃO DO MODELO */}
      <details className="mx-auto w-full max-w-3xl rounded-lg bg-panel/40 p-4 text-sm" open>
        <summary className="cursor-pointer font-bold text-gold">
          📖 Como funciona o Sistema Suíço
        </summary>
        <div className="mt-3 flex flex-col gap-2 text-faint">
          <p>
            O Sistema Suíço segue uma regra de ouro: <b className="text-white">quem está ganhando
            joga contra quem está ganhando, e quem está perdendo joga contra quem está perdendo</b>.
            Ninguém é eliminado por um único tropeço (como no mata-mata) e não é preciso todos
            jogarem contra todos (como nos pontos corridos).
          </p>
          <p>
            Neste torneio de <b className="text-white">{teamIds.length} times</b> em{" "}
            <b className="text-white">{rounds} rodadas</b>: atingiu{" "}
            <b className="text-win">{qualifyWins} vitórias</b> está classificado; acumulou{" "}
            <b className="text-loss">{eliminateLosses} derrotas</b> está eliminado.
          </p>
          <p className="font-semibold text-white">Rodada a rodada (exemplo de 8 times):</p>
          <p>
            <b className="text-draw">Rodada 1 (pote 0-0):</b> todos começam zerados. Saem 4
            vencedores (vão para 1-0) e 4 perdedores (vão para 0-1).
          </p>
          <p>
            <b className="text-draw">Rodada 2:</b> o pote <b>1-0</b> joga entre si — quem vence chega
            a <b className="text-win">2-0 e está classificado</b>; quem perde cai para 1-1. O pote{" "}
            <b>0-1</b> também joga entre si — quem vence sobe para 1-1; quem perde chega a{" "}
            <b className="text-loss">0-2 e está eliminado</b>.
          </p>
          <p>
            <b className="text-draw">Rodada 3 (pote 1-1):</b> os 4 restantes (todos 1-1) decidem —
            quem vence faz <b className="text-win">2-1 e garante a vaga</b>; quem perde faz{" "}
            <b className="text-loss">1-2 e é eliminado</b>.
          </p>
          <p>
            <b className="text-white">Resultado:</b> em 3 rodadas, 4 classificados (os 2-0 invictos +
            os 2-1) e 4 eliminados (0-2 e 1-2). As rodadas finais são sempre parelhas, pois os times
            enfrentam rivais de nível técnico similar.
          </p>
          <p className="font-semibold text-white">Como chega à Semifinal e à Final:</p>
          <p>
            <b className="text-gold">Semifinais:</b> os 4 classificados se cruzam — os{" "}
            <b className="text-win">invictos (2-0)</b> enfrentam os{" "}
            <b className="text-win">recuperados (2-1)</b> (ex.: 2-0 #1 × 2-1 #2 e 2-0 #2 × 2-1 #1),
            em jogo único.
          </p>
          <p>
            <b className="text-gold">Final:</b> os <b className="text-white">vencedores das duas
            semifinais</b> decidem o título. (O chaveamento acima preenche os placares
            automaticamente conforme os jogos da fase final são registrados.)
          </p>
        </div>
      </details>
    </div>
  );
}
