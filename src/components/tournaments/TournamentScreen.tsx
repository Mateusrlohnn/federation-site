import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { ACCENT } from "@/components/ui/stats";
import maxwidth from "@/styles/maxwidth.module.css";
import { avatarUrl } from "@/lib/hof";
import { focusStyle } from "@/lib/imageFocus";
import { POSITIONS, type Position } from "@/lib/teams";
import {
  computeTopScorers,
  computeTopAssists,
  playerLines,
  teamScorers,
  teamResult,
  isGoal,
  matchLineupFor,
  type Match,
  type PlayerLine,
  type Grade,
} from "@/lib/tournaments";
import { statusStyle, type TourTeam } from "@/components/tournaments/shared";
import MatchSheet, {
  AllSheetsButton,
  type SheetData,
  type SheetSide,
  type AllSheetsSection,
  type AllSheetsMatch,
} from "@/components/tournaments/MatchSheet";
import TeamStatsSection, {
  type TeamStat,
  type StatLeader,
} from "@/components/tournaments/TeamStatsSection";
import FormatView from "@/components/tournaments/FormatView";
import { formatLabel, tournamentPhases, type TournamentFormat } from "@/lib/formats";

/**
 * Tela completa de uma copa (rota /tournaments/[id]).
 * Layout gamificado e descontraído: hero com banner + foto, placar HUD,
 * jogo ao vivo, pódios de artilharia/assistências, últimos jogos, top por
 * posição (copa encerrada), notícias e elenco de times. Apenas apresentação.
 */

export type ScreenData = {
  id: string;
  name: string;
  status: string;
  banner: string;
  logo: string;
  championName: string | null;
  championTeamId: string | null;
  runnerUpName: string | null;
  runnerUpTeamId: string | null;
  organizerName: string | null;
  format: TournamentFormat | null;
  groupCount: number | null;
  teams: TourTeam[];
  matches: Match[];
  messages: { body: string }[];
  playerNames: Record<string, string>;
  playerNicks: Record<string, string>;
  playerPositions: Record<string, Position | null>;
  teamNames: Record<string, string>;
  teamLogos: Record<string, string>;
  teamRosters: Record<string, { playerId: string; position: Position | null; active: boolean }[]>;
  // elenco por time NESTA copa (escolhido a dedo); vazio = cai no elenco global do time
  teamSquads: Record<string, { playerId: string; position: Position | null }[]>;
  awards: Record<string, string>; // award_key -> player_id (pódio atribuído pelo admin)
  championPlayers: string[]; // jogadores campeões DESTA copa (subconjunto do elenco)
  runnerUpPlayers: string[]; // jogadores vice-campeões DESTA copa
};

const MEDALS = ["#ffb300", "#c7ccd1", "#cd7f32"]; // ouro, prata, bronze

/** Goleadores embaixo do time: avatar + nome + minuto (ex.: Aduzn 4'). */
function ScorerList({
  items,
}: {
  items: { name: string; nick?: string; minute: number | null; penalty: boolean; ownGoal: boolean }[];
}) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-col items-center gap-1">
      {items.map((s, i) => (
        <span key={i} className="flex items-center gap-1 text-xs">
          <PlayerAvatar name={s.name} nick={s.nick} size={20} />
          <span className="text-sm leading-none">{s.ownGoal ? "🥅" : "⚽"}</span>
          {s.penalty && <span className="text-[9px] font-bold text-faint">P</span>}
          {s.ownGoal && <span className="text-[9px] font-bold text-loss">(contra)</span>}
          <span className="font-semibold">{s.name}</span>
          {s.minute != null && <span className="font-mono text-faint">{s.minute}&apos;</span>}
        </span>
      ))}
    </div>
  );
}

/** Selos "extras" de um jogador (sem gols): pênalti perdido, assist, cartões. */
function extraBadges(l: PlayerLine) {
  const out: { emoji: string; n: number; title: string }[] = [];
  if (l.ownGoals) out.push({ emoji: "🥅", n: l.ownGoals, title: "Gols contra" });
  if (l.penaltyMisses) out.push({ emoji: "🔴", n: l.penaltyMisses, title: "Pênaltis perdidos" });
  if (l.assists) out.push({ emoji: "👟", n: l.assists, title: "Assistências" });
  if (l.yellow) out.push({ emoji: "🟨", n: l.yellow, title: "Cartões amarelos" });
  if (l.red) out.push({ emoji: "🟥", n: l.red, title: "Cartões vermelhos" });
  return out;
}

/** Linha de um jogador na ficha de extras: avatar + nome + ícones. */
function PlayerExtraRow({ name, nick, line }: { name: string; nick?: string; line: PlayerLine }) {
  return (
    <div className="flex items-center gap-2">
      <PlayerAvatar name={name} nick={nick} size={30} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        {extraBadges(line).map((b, i) => (
          <span key={i} className="inline-flex items-center text-sm" title={b.title}>
            {Array.from({ length: b.n }).map((_, k) => (
              <span key={k} className="leading-none">
                {b.emoji}
              </span>
            ))}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Jogadores de um time com eventos que NÃO são gols (assist/cartões/pênalti perdido). */
function teamExtraLines(m: Match, teamId: string | null): { playerId: string; line: PlayerLine }[] {
  const lines = playerLines(m.events);
  const playerTeam = new Map<string, string | null>();
  for (const e of m.events) if (!playerTeam.has(e.playerId)) playerTeam.set(e.playerId, e.teamId);
  return [...lines.values()]
    .filter((l) => (playerTeam.get(l.playerId) ?? null) === teamId)
    .filter((l) => extraBadges(l).length > 0)
    .map((line) => ({ playerId: line.playerId, line }));
}

/** Cabeçalho de seção sem "caixa": ícone + título + linha que se esvai. */
function SectionHeader({
  icon,
  color,
  title,
  hint,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  color: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl text-base"
        style={{ backgroundColor: `${color}22`, color }}
      >
        <Icon name={icon} />
      </span>
      <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
      {hint && <span className="text-xs font-semibold text-faint">{hint}</span>}
      <span className="ml-1 h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
    </div>
  );
}

/** Avatar do jogador (corpo Habbo) num quadro arredondado. nick puxa o avatar. */
function PlayerAvatar({
  name,
  nick,
  size = 56,
}: {
  name: string;
  nick?: string;
  size?: number;
}) {
  return (
    <span
      className="flex shrink-0 items-end justify-center overflow-hidden rounded-xl bg-panel"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarUrl(nick || name)}
        alt={name}
        className="object-contain"
        style={{ width: size, height: size * 1.25 }}
      />
    </span>
  );
}

type AwardPerson = { name: string; nick?: string } | null;

/** Avatar "surpresa" (top ainda não divulgado). */
function MysteryAvatar({ size }: { size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-base/60 ring-1 ring-dashed ring-white/15"
      style={{ width: size, height: size }}
    >
      <span className="text-2xl font-black text-faint">?</span>
    </span>
  );
}

/** Uma vaga do pódio (1º/2º/3º) com pedestal colorido; vazio = "Em breve". */
function PodiumSpot({ place, person }: { place: number; person: AwardPerson }) {
  const color = MEDALS[place - 1] ?? "#8a8a93";
  const avatarSize = place === 1 ? 60 : 46;
  const barH = place === 1 ? 56 : place === 2 ? 40 : 30;
  return (
    <div className="flex w-1/3 flex-col items-center">
      {person ? (
        <PlayerAvatar name={person.name} nick={person.nick} size={avatarSize} />
      ) : (
        <MysteryAvatar size={avatarSize} />
      )}
      <span
        className={`mt-1 w-full truncate px-0.5 text-center text-[11px] font-bold ${person ? "" : "text-faint"}`}
        title={person ? person.name : "Em breve…"}
      >
        {person ? person.name : "Em breve…"}
      </span>
      <div
        className="mt-1 flex w-full items-start justify-center rounded-t-md"
        style={{ height: barH, background: `linear-gradient(180deg, ${color}, ${color}22)` }}
      >
        <span className="mt-0.5 text-sm font-black text-[#1a1a1e]">{place}</span>
      </div>
    </div>
  );
}

/** Pódio de uma posição (1º no meio e mais alto). */
function PositionPodium({
  label,
  spots,
}: {
  label: string;
  spots: { place: number; person: AwardPerson }[];
}) {
  const order = [spots[1], spots[0], spots[2]]; // 2º, 1º, 3º
  return (
    <div className="rounded-xl bg-card p-3 ring-1 ring-white/5">
      <div className="mb-3 text-center text-xs font-extrabold uppercase tracking-wide text-faint">
        {label}
      </div>
      <div className="flex items-end justify-center gap-1.5">
        {order.map((s) => (
          <PodiumSpot key={s.place} place={s.place} person={s.person} />
        ))}
      </div>
    </div>
  );
}

/** Card de prêmio especial (Melhor da Copa, etc.). Só aparece quando atribuído. */
function SpecialAwardCard({
  label,
  icon,
  color,
  person,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  color: string;
  person: AwardPerson;
}) {
  if (!person) return null;
  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-white/5"
      style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
    >
      <PlayerAvatar name={person.name} nick={person.nick} size={50} />
      <div className="flex min-w-0 flex-col">
        <span
          className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide"
          style={{ color }}
        >
          <Icon name={icon} /> {label}
        </span>
        <span className="truncate text-sm font-bold">{person.name}</span>
      </div>
    </div>
  );
}

function TeamLogo({ logo, size = 40 }: { logo?: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-base"
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full object-cover" style={focusStyle(logo)} />
      ) : (
        <Icon name="shield" className="text-faint" />
      )}
    </span>
  );
}

/** Pódio top-3 com avatares e medalhas + lista do resto. */
function RankingPodium({
  entries,
  player,
  nick,
  accent,
  unit,
}: {
  entries: { playerId: string; value: number }[];
  player: (id: string) => string;
  nick: (id: string) => string;
  accent: string;
  unit: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-faint">Nada registrado ainda.</p>;
  }
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3, 10);
  // ordem visual no pódio: 2º, 1º, 3º
  const order = [podium[1], podium[0], podium[2]].filter(Boolean) as {
    playerId: string;
    value: number;
  }[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-center gap-3 sm:gap-5">
        {order.map((e) => {
          const rank = podium.findIndex((p) => p.playerId === e.playerId);
          const isFirst = rank === 0;
          return (
            <div key={e.playerId} className="flex flex-col items-center">
              <span
                className="mb-1 text-xs font-extrabold"
                style={{ color: MEDALS[rank] }}
              >
                {rank === 0 ? "🥇" : rank === 1 ? "🥈" : "🥉"}
              </span>
              <div
                className="rounded-2xl p-0.5"
                style={{ boxShadow: `0 0 0 2px ${MEDALS[rank]}` }}
              >
                <PlayerAvatar name={player(e.playerId)} nick={nick(e.playerId)} size={isFirst ? 76 : 60} />
              </div>
              <span className="mt-1.5 max-w-[88px] truncate text-center text-sm font-bold">
                {player(e.playerId)}
              </span>
              <span
                className="text-lg font-extrabold leading-none"
                style={{ color: accent }}
              >
                {e.value}
                <span className="ml-0.5 text-[10px] font-semibold text-faint">{unit}</span>
              </span>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ul className="flex flex-col gap-1">
          {rest.map((e, i) => (
            <li
              key={e.playerId}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 odd:bg-white/[0.02]"
            >
              <span className="w-5 text-center font-mono text-sm font-bold text-faint">
                {i + 4}
              </span>
              <PlayerAvatar name={player(e.playerId)} nick={nick(e.playerId)} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {player(e.playerId)}
              </span>
              <span className="text-sm font-extrabold" style={{ color: accent }}>
                {e.value}
                <span className="ml-0.5 text-[10px] font-semibold text-faint">{unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TournamentScreen({ data }: { data: ScreenData }) {
  const team = (id: string | null) => (id ? data.teamNames[id] ?? "—" : "—");
  const logo = (id: string | null) => (id ? data.teamLogos[id] ?? "" : "");
  const player = (id: string) => data.playerNames[id] ?? id;
  const nickOf = (id: string) => data.playerNicks?.[id] || data.playerNames[id] || id;
  const scorersOf = (m: Match, teamId: string | null) => {
    const opponentId = teamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    return teamScorers(m.events, teamId, opponentId).map((s) => ({
      name: player(s.playerId),
      nick: nickOf(s.playerId),
      minute: s.minute,
      penalty: s.penalty,
      ownGoal: s.ownGoal,
    }));
  };

  const siglaFor = (pos: Position | null) =>
    pos ? POSITIONS.find((p) => p.key === pos)?.sigla ?? null : null;
  const POS_RANK = ["GK", "ZAG", "MID", "ATK"];

  // Elenco derivado de cada time NESTA copa: todos que apareceram em escalações ou
  // eventos das partidas desta copa. Usado como fallback quando a partida não tem
  // escalação registrada nem elenco-da-copa salvo — assim a copa NUNCA usa o elenco
  // global (compartilhado entre copas) e fica imune a edições feitas nele.
  const derivedSquadByTeam = new Map<string, Map<string, Position | null>>();
  {
    const add = (teamId: string | null, pid: string, pos: Position | null) => {
      if (!teamId) return;
      let mp = derivedSquadByTeam.get(teamId);
      if (!mp) derivedSquadByTeam.set(teamId, (mp = new Map()));
      if (!mp.has(pid)) mp.set(pid, pos);
    };
    for (const mt of data.matches) {
      for (const l of mt.lineups)
        add(l.teamId, l.playerId, l.position ?? data.playerPositions[l.playerId] ?? null);
      for (const e of mt.events) {
        add(e.teamId, e.playerId, data.playerPositions[e.playerId] ?? null);
        if (e.type === "substitution" && e.outPlayerId)
          add(e.teamId, e.outPlayerId, data.playerPositions[e.outPlayerId] ?? null);
      }
    }
  }

  // Monta a súmula completa: elenco em campo por posição + eventos de cada jogador.
  function buildSheet(m: Match): SheetData {
    const lines = playerLines(m.events);
    // minutos de entrada/saída por jogador (substituições)
    const subIn = new Map<string, number | null>();
    const subOut = new Map<string, number | null>();
    for (const e of m.events)
      if (e.type === "substitution") {
        subIn.set(e.playerId, e.minute);
        if (e.outPlayerId) subOut.set(e.outPlayerId, e.minute);
      }
    const side = (teamId: string | null, score: number): SheetSide => {
      const lineupRows = matchLineupFor(m, teamId);
      const roster = teamId ? data.teamRosters[teamId] ?? [] : [];
      const ids: string[] = [];
      const seen = new Set<string>();
      const posOf = new Map<string, Position | null>();
      const ratingOf = new Map<string, Grade | null>();
      const add = (pid: string) => {
        if (seen.has(pid)) return;
        seen.add(pid);
        ids.push(pid);
      };
      const cupSquad = teamId ? data.teamSquads[teamId] ?? [] : [];
      if (lineupRows.length) {
        // escalação registrada nesta partida: só quem foi escalado
        for (const l of lineupRows) {
          add(l.playerId);
          posOf.set(l.playerId, l.position);
          ratingOf.set(l.playerId, l.rating);
        }
      } else if (cupSquad.length) {
        // sem escalação, mas há elenco-da-copa definido: usa esse (não o global)
        for (const r of cupSquad) {
          add(r.playerId);
          posOf.set(r.playerId, r.position ?? data.playerPositions[r.playerId] ?? null);
        }
      } else {
        // sem escalação e sem elenco-da-copa salvo: deriva de quem jogou NESTA copa
        // (escalações + eventos). Nunca usa o elenco global (compartilhado entre copas).
        const derived = teamId ? derivedSquadByTeam.get(teamId) : null;
        if (derived)
          for (const [pid, pos] of derived) {
            add(pid);
            posOf.set(pid, pos);
          }
      }
      // garante quem tem evento desse time (inclui quem saiu numa substituição)
      for (const e of m.events)
        if (e.teamId === teamId) {
          add(e.playerId);
          if (e.type === "substitution" && e.outPlayerId) add(e.outPlayerId);
        }
      const lineup = ids.map((pid) => {
        const pos = posOf.has(pid)
          ? posOf.get(pid) ?? null
          : roster.find((r) => r.playerId === pid)?.position ?? data.playerPositions[pid] ?? null;
        const l = lines.get(pid);
        const goalMinutes = m.events
          .filter((e) => e.playerId === pid && isGoal(e.type))
          .map((e) => e.minute);
        return {
          name: player(pid),
          nick: nickOf(pid),
          posSigla: siglaFor(pos),
          goals: (l?.goals ?? 0) + (l?.penaltyGoals ?? 0),
          goalMinutes,
          ownGoals: l?.ownGoals ?? 0,
          penaltyMisses: l?.penaltyMisses ?? 0,
          assists: l?.assists ?? 0,
          yellow: l?.yellow ?? 0,
          red: l?.red ?? 0,
          rating: ratingOf.get(pid) ?? null,
          subbedIn: subIn.has(pid),
          subbedOut: subOut.has(pid),
          subInMinute: subIn.get(pid) ?? null,
          subOutMinute: subOut.get(pid) ?? null,
        };
      });
      lineup.sort((a, b) => {
        const ia = a.posSigla ? POS_RANK.indexOf(a.posSigla) : 99;
        const ib = b.posSigla ? POS_RANK.indexOf(b.posSigla) : 99;
        return ia - ib || a.name.localeCompare(b.name);
      });
      return { name: team(teamId), logo: logo(teamId), score, lineup };
    };
    // disputa de pênaltis (na ordem das cobranças registradas)
    const kicksOf = (teamId: string | null) =>
      m.events
        .filter(
          (e) => e.teamId === teamId && (e.type === "shootout_goal" || e.type === "shootout_miss"),
        )
        .map((e) => ({
          name: player(e.playerId),
          nick: nickOf(e.playerId),
          scored: e.type === "shootout_goal",
        }));
    const homeKicks = kicksOf(m.homeTeamId);
    const awayKicks = kicksOf(m.awayTeamId);
    return {
      home: side(m.homeTeamId, m.homeScore),
      away: side(m.awayTeamId, m.awayScore),
      playedAt: m.playedAt,
      mvpName: m.mvpPlayerId ? player(m.mvpPlayerId) : null,
      shootout:
        homeKicks.length || awayKicks.length ? { home: homeKicks, away: awayKicks } : null,
      wo: m.wo
        ? {
            winner:
              m.homeScore === m.awayScore
                ? null
                : team(m.homeScore > m.awayScore ? m.homeTeamId : m.awayTeamId),
          }
        : null,
    };
  }

  const live = data.matches.filter((m) => m.isLive);
  // próximas partidas (agendadas, ainda sem resultado)
  const upcoming = data.matches
    .filter((m) => m.scheduled)
    .sort((a, b) => (a.playedAt ?? "~").localeCompare(b.playedAt ?? "~"));
  // últimos jogos = finalizados (não ao vivo nem agendados)
  const recent = data.matches
    .filter((m) => !m.isLive && !m.scheduled)
    .sort((a, b) => (b.playedAt ?? "").localeCompare(a.playedAt ?? ""))
    .slice(0, 8);

  // TODAS as súmulas agrupadas por fase (Rodada 1, Quartas de final, etc.).
  const allSheetSections: AllSheetsSection[] = (() => {
    const finishedAll = data.matches.filter(
      (m) => !m.isLive && !m.scheduled && m.homeTeamId && m.awayTeamId,
    );
    const toSheetMatch = (m: Match): AllSheetsMatch => ({
      home: { name: team(m.homeTeamId), logo: logo(m.homeTeamId) },
      away: { name: team(m.awayTeamId), logo: logo(m.awayTeamId) },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      playedAt: m.playedAt,
      sheet: buildSheet(m),
    });
    const remaining = new Set(finishedAll);
    const phases = tournamentPhases(data.format, data.teams, data.matches, data.groupCount);
    const sections: AllSheetsSection[] = [];
    for (const ph of phases) {
      const ms: Match[] = [];
      for (const { a, b } of ph.pairs) {
        const found = [...remaining].find(
          (x) =>
            (x.homeTeamId === a && x.awayTeamId === b) ||
            (x.homeTeamId === b && x.awayTeamId === a),
        );
        if (found) {
          ms.push(found);
          remaining.delete(found);
        }
      }
      if (ms.length) sections.push({ label: ph.label, matches: ms.map(toSheetMatch) });
    }
    if (remaining.size)
      sections.push({
        label: "Demais jogos",
        matches: finishedAll.filter((m) => remaining.has(m)).map(toSheetMatch),
      });
    return sections;
  })();

  const scorers = computeTopScorers(data.matches);
  const assists = computeTopAssists(data.matches);
  const totalGoals = scorers.reduce((s, x) => s + x.goals, 0);

  // Pódio atribuído pelo admin: jogador de um prêmio (ou null = "Em breve").
  const awardPlayer = (key: string) =>
    data.awards[key] ? { name: player(data.awards[key]), nick: nickOf(data.awards[key]) } : null;
  const specialAwards = [
    { key: "best_player", label: "Melhor da Copa", icon: "trophy" as const, color: ACCENT.gold },
    { key: "best_gk", label: "Melhor Goleiro", icon: "shield" as const, color: ACCENT.draw },
    { key: "revelation", label: "Revelação", icon: "futbol" as const, color: ACCENT.win },
  ].map((a) => ({ ...a, player: awardPlayer(a.key) }));

  const hud = [
    { icon: "shield" as const, color: ACCENT.draw, value: data.teams.length, label: "Times" },
    { icon: "note-sticky" as const, color: ACCENT.win, value: data.matches.length, label: "Jogos" },
    { icon: "futbol" as const, color: ACCENT.gold, value: totalGoals, label: "Gols" },
  ];

  // Estatísticas de cada time DENTRO do torneio (para o modal clicável).
  const top = (counts: Map<string, number>): StatLeader => {
    let best: StatLeader = null;
    for (const [pid, v] of counts)
      if (v > 0 && (!best || v > best.value))
        best = { name: player(pid), nick: nickOf(pid), value: v };
    return best;
  };
  const teamStats: TeamStat[] = data.teams.map((tm) => {
    const teamMatches = data.matches.filter(
      (m) => m.homeTeamId === tm.id || m.awayTeamId === tm.id,
    );
    const finishedM = teamMatches.filter((m) => !m.scheduled && !m.isLive);
    let wins = 0;
    let losses = 0;
    let draws = 0;
    for (const m of finishedM) {
      const r = teamResult(m, tm.id);
      if (r === "win") wins++;
      else if (r === "loss") losses++;
      else draws++;
    }

    // contadores por jogador (eventos do time)
    const g = new Map<string, number>();
    const a = new Map<string, number>();
    const y = new Map<string, number>();
    const rc = new Map<string, number>();
    for (const m of data.matches)
      for (const e of m.events)
        if (e.teamId === tm.id) {
          if (isGoal(e.type)) g.set(e.playerId, (g.get(e.playerId) ?? 0) + 1);
          else if (e.type === "assist") a.set(e.playerId, (a.get(e.playerId) ?? 0) + 1);
          else if (e.type === "yellow_card") y.set(e.playerId, (y.get(e.playerId) ?? 0) + 1);
          else if (e.type === "red_card") rc.set(e.playerId, (rc.get(e.playerId) ?? 0) + 1);
        }

    // Elenco do time NESTA copa: derivado de quem jogou (escalações + eventos),
    // não do elenco global. Assim um mesmo time (ex.: Napoli) mostra o elenco
    // certo em cada copa, sem precisar criar times duplicados.
    const squadPos = new Map<string, Position | null>();
    const addSquad = (pid: string, pos: Position | null) => {
      if (!squadPos.has(pid)) squadPos.set(pid, pos);
    };
    for (const m of data.matches) {
      for (const l of m.lineups)
        if (l.teamId === tm.id)
          addSquad(l.playerId, l.position ?? data.playerPositions[l.playerId] ?? null);
      for (const e of m.events)
        if (e.teamId === tm.id) {
          addSquad(e.playerId, data.playerPositions[e.playerId] ?? null);
          if (e.type === "substitution" && e.outPlayerId)
            addSquad(e.outPlayerId, data.playerPositions[e.outPlayerId] ?? null);
        }
    }
    const roster = [...squadPos.entries()].map(([playerId, position]) => ({
      playerId,
      position,
      active: true,
    }));
    const toPlayer = (r: { playerId: string }) => ({
      name: player(r.playerId),
      nick: nickOf(r.playerId),
    });
    const lineup = POSITIONS.map((pos) => ({
      sigla: pos.sigla,
      players: roster
        .filter((r) => (r.position ?? data.playerPositions[r.playerId] ?? null) === pos.key)
        .map(toPlayer)
        .sort((x, z) => x.name.localeCompare(z.name)),
    })).filter((grp) => grp.players.length > 0);
    const semPos = roster
      .filter((r) => (r.position ?? data.playerPositions[r.playerId] ?? null) === null)
      .map(toPlayer);
    if (semPos.length)
      lineup.push({ sigla: "—", players: semPos.sort((x, z) => x.name.localeCompare(z.name)) });

    const opp = (m: Match) => (m.homeTeamId === tm.id ? m.awayTeamId : m.homeTeamId);
    const last = [...finishedM]
      .sort((x, z) => (z.playedAt ?? "").localeCompare(x.playedAt ?? ""))
      .slice(0, 5)
      .map((m) => ({
        opponent: team(opp(m)),
        opponentLogo: logo(opp(m)),
        forScore: m.homeTeamId === tm.id ? m.homeScore : m.awayScore,
        againstScore: m.homeTeamId === tm.id ? m.awayScore : m.homeScore,
        result: teamResult(m, tm.id),
        date: m.playedAt,
      }));
    const upcoming = teamMatches
      .filter((m) => m.scheduled)
      .sort((x, z) => (x.playedAt ?? "").localeCompare(z.playedAt ?? ""))
      .map((m) => ({ opponent: team(opp(m)), opponentLogo: logo(opp(m)), date: m.playedAt }));

    return {
      id: tm.id,
      name: tm.name,
      logo: tm.logo,
      isChampion: tm.id === data.championTeamId,
      wins,
      losses,
      draws,
      topScorer: top(g),
      topAssister: top(a),
      topYellow: top(y),
      topRed: top(rc),
      lineup,
      last,
      upcoming,
    };
  });

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      <Link
        href="/tournaments"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-faint transition-colors hover:text-white"
      >
        ← Torneios
      </Link>

      {/* HERO: banner + foto sobreposta */}
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-white/5">
        <div className="relative h-52 w-full sm:h-72">
          {data.banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.banner}
              alt={data.name}
              className="h-full w-full object-cover"
              style={focusStyle(data.banner)}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-panel via-card to-base" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          {live.length > 0 && (
            <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-loss px-3 py-1 text-xs font-extrabold text-white shadow-lg">
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> AO VIVO
            </span>
          )}
        </div>

        {/* faixa inferior do hero */}
        <div className="relative -mt-16 flex flex-wrap items-end gap-4 px-5 pb-5 sm:px-7">
          <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-panel shadow-xl ring-2 ring-white/10 sm:h-28 sm:w-28">
            {data.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.logo}
                alt={data.name}
                className="h-full w-full object-cover"
                style={focusStyle(data.logo)}
              />
            ) : (
              <Icon name="trophy" className="text-4xl text-gold/40" />
            )}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                  statusStyle[data.status] ?? "bg-panel text-faint"
                }`}
              >
                {data.status}
              </span>
              {data.championName && (
                <span className="flex items-center gap-1 rounded-md bg-gold px-2.5 py-0.5 text-xs font-bold text-[#1a1a1e]">
                  <Icon name="trophy" /> Campeão: {data.championName}
                </span>
              )}
              {data.runnerUpName && (
                <span className="flex items-center gap-1 rounded-md bg-panel px-2.5 py-0.5 text-xs font-bold text-faint ring-1 ring-white/10">
                  🥈 Vice: {data.runnerUpName}
                </span>
              )}
            </div>
            {data.championPlayers.length > 0 && (
              <p className="mb-1 text-xs text-faint">
                <span className="font-bold text-gold">🏅 Campeões:</span>{" "}
                {data.championPlayers.map((id) => data.playerNames[id] ?? id).join(", ")}
              </p>
            )}
            {data.runnerUpPlayers.length > 0 && (
              <p className="mb-1.5 text-xs text-faint">
                <span className="font-bold">Vice-campeões:</span>{" "}
                {data.runnerUpPlayers.map((id) => data.playerNames[id] ?? id).join(", ")}
              </p>
            )}
            <h1 className="text-3xl font-extrabold leading-none tracking-tight sm:text-5xl">
              {data.name}
            </h1>
            {data.organizerName && (
              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-faint">
                <Icon name="user" className="text-win" />
                Organizado por <span className="text-white">{data.organizerName}</span>
              </p>
            )}
          </div>

          {/* HUD de números */}
          <div className="flex gap-2">
            {hud.map((h) => (
              <div
                key={h.label}
                className="flex min-w-[68px] flex-col items-center rounded-xl bg-panel/60 px-3 py-2"
              >
                <Icon name={h.icon} style={{ color: h.color }} />
                <span className="text-2xl font-extrabold leading-tight">{h.value}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-faint">
                  {h.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-10">
        {/* FORMATO: tabela de classificação / chave / suíço */}
        {data.format && (
          <section>
            <SectionHeader
              icon="trophy"
              color={ACCENT.gold}
              title={formatLabel(data.format)}
              hint="atualiza conforme os resultados"
            />
            <FormatView
              format={data.format}
              teams={data.teams}
              matches={data.matches}
              groupCount={data.groupCount}
            />
          </section>
        )}

        {/* AO VIVO */}
        {live.length > 0 && (
          <section>
            <SectionHeader icon="futbol" color={ACCENT.loss} title="Acontecendo agora" />
            <div className="flex flex-col gap-4">
              {live.map((m, i) => (
                <div
                  key={m.id ?? i}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-loss/15 via-panel to-panel p-5 ring-1 ring-loss/30"
                >
                  <span className="absolute right-4 top-4 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-loss">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-loss" /> Live
                  </span>
                  <div className="flex items-start justify-center gap-4 sm:gap-8">
                    <div className="flex flex-1 flex-col items-center gap-2 text-center">
                      <TeamLogo logo={logo(m.homeTeamId)} size={64} />
                      <span className="truncate text-sm font-bold">{team(m.homeTeamId)}</span>
                      <ScorerList items={scorersOf(m, m.homeTeamId)} />
                    </div>
                    <div className="flex shrink-0 items-center gap-3 pt-6 text-5xl font-extrabold tabular-nums sm:text-6xl">
                      <span>{m.homeScore}</span>
                      <span className="text-2xl text-faint">×</span>
                      <span>{m.awayScore}</span>
                    </div>
                    <div className="flex flex-1 flex-col items-center gap-2 text-center">
                      <TeamLogo logo={logo(m.awayTeamId)} size={64} />
                      <span className="truncate text-sm font-bold">{team(m.awayTeamId)}</span>
                      <ScorerList items={scorersOf(m, m.awayTeamId)} />
                    </div>
                  </div>

                  <p className="mt-4 text-center text-[11px] text-faint">
                    ⭐ MVP e cartões serão exibidos quando a partida for encerrada.
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DESTAQUES: artilharia + assistências */}
        <div className="grid gap-10 md:grid-cols-2">
          <section>
            <SectionHeader icon="futbol" color={ACCENT.gold} title="Artilharia" />
            <RankingPodium
              entries={scorers.map((s) => ({ playerId: s.playerId, value: s.goals }))}
              player={player}
              nick={nickOf}
              accent={ACCENT.gold}
              unit="g"
            />
          </section>

          <section>
            <SectionHeader icon="handshake-angle" color={ACCENT.draw} title="Assistências" />
            <RankingPodium
              entries={assists.map((s) => ({ playerId: s.playerId, value: s.assists }))}
              player={player}
              nick={nickOf}
              accent={ACCENT.draw}
              unit="a"
            />
          </section>
        </div>

        {/* PRÓXIMAS PARTIDAS (agendadas, ainda sem resultado) */}
        {upcoming.length > 0 && (
          <section>
            <SectionHeader icon="trophy" color={ACCENT.draw} title="Próximas partidas" />
            <div className="grid gap-2 sm:grid-cols-2">
              {upcoming.map((m, i) => (
                <div
                  key={m.id ?? i}
                  className="flex items-center gap-3 rounded-xl bg-panel/50 px-4 py-3"
                >
                  <div className="flex flex-1 items-center gap-2">
                    <TeamLogo logo={logo(m.homeTeamId)} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {team(m.homeTeamId)}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-center">
                    <span className="rounded bg-base px-2 py-0.5 text-[11px] font-bold text-faint">
                      vs
                    </span>
                    {m.playedAt && <span className="mt-0.5 text-[10px] text-faint">{m.playedAt}</span>}
                  </div>
                  <div className="flex flex-1 flex-row-reverse items-center gap-2 text-right">
                    <TeamLogo logo={logo(m.awayTeamId)} size={32} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                      {team(m.awayTeamId)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ÚLTIMOS JOGOS */}
        <section>
          <SectionHeader icon="note-sticky" color={ACCENT.win} title="Últimos jogos" />
          {recent.length === 0 ? (
            <p className="text-sm text-faint">Nenhuma partida registrada ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {recent.map((m, i) => {
                const homeWin = m.homeScore > m.awayScore;
                const awayWin = m.awayScore > m.homeScore;
                const homeExtras = teamExtraLines(m, m.homeTeamId);
                const awayExtras = teamExtraLines(m, m.awayTeamId);
                const hasExtras = homeExtras.length > 0 || awayExtras.length > 0;
                return (
                  <div key={m.id ?? i} className="overflow-hidden rounded-2xl bg-panel/50">
                    {/* placar com goleadores embaixo de cada time */}
                    <div className="flex items-start gap-3 px-4 py-4">
                      <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                        <TeamLogo logo={logo(m.homeTeamId)} size={40} />
                        <span className={`text-sm font-bold ${homeWin ? "text-white" : "text-faint"}`}>
                          {team(m.homeTeamId)}
                        </span>
                        <ScorerList items={scorersOf(m, m.homeTeamId)} />
                      </div>
                      <div className="flex shrink-0 flex-col items-center pt-2">
                        <span className="text-3xl font-extrabold tabular-nums">
                          <span style={{ color: homeWin ? ACCENT.win : undefined }}>
                            {m.homeScore}
                          </span>
                          <span className="mx-1.5 text-faint">×</span>
                          <span style={{ color: awayWin ? ACCENT.win : undefined }}>
                            {m.awayScore}
                          </span>
                        </span>
                        {m.playedAt && <span className="text-[10px] text-faint">{m.playedAt}</span>}
                        {m.wo && (
                          <span className="mt-0.5 rounded bg-loss/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-loss">
                            W.O.
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col items-center gap-1.5 text-center">
                        <TeamLogo logo={logo(m.awayTeamId)} size={40} />
                        <span className={`text-sm font-bold ${awayWin ? "text-white" : "text-faint"}`}>
                          {team(m.awayTeamId)}
                        </span>
                        <ScorerList items={scorersOf(m, m.awayTeamId)} />
                      </div>
                    </div>

                    {/* MVP */}
                    {m.mvpPlayerId && (
                      <div className="flex items-center justify-center gap-2 border-t border-white/5 bg-gold/10 py-2">
                        <span className="text-base">⭐</span>
                        <PlayerAvatar name={player(m.mvpPlayerId)} nick={nickOf(m.mvpPlayerId)} size={28} />
                        <span className="text-sm font-bold text-gold">
                          MVP: {player(m.mvpPlayerId)}
                        </span>
                      </div>
                    )}

                    {/* assistências e cartões por time */}
                    {hasExtras && (
                      <div className="grid gap-x-6 gap-y-2 border-t border-white/5 px-4 py-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          {homeExtras.map((x) => (
                            <PlayerExtraRow
                              key={x.playerId}
                              name={player(x.playerId)}
                              nick={nickOf(x.playerId)}
                              line={x.line}
                            />
                          ))}
                        </div>
                        <div className="flex flex-col gap-2">
                          {awayExtras.map((x) => (
                            <PlayerExtraRow
                              key={x.playerId}
                              name={player(x.playerId)}
                              nick={nickOf(x.playerId)}
                              line={x.line}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* súmula completa */}
                    <MatchSheet sheet={buildSheet(m)} />
                  </div>
                );
              })}
            </div>
          )}
          <AllSheetsButton sections={allSheetSections} />
        </section>

        {/* PÓDIO DA COPA (atribuído pelo admin; vazio = "Em breve") */}
        <section>
          <SectionHeader
            icon="trophy"
            color={ACCENT.gold}
            title="Pódio da copa"
            hint="top 1 · 2 · 3 por posição"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POSITIONS.map((pos) => (
              <PositionPodium
                key={pos.key}
                label={pos.label}
                spots={[1, 2, 3].map((place) => ({
                  place,
                  person: awardPlayer(`${pos.key}_${place}`),
                }))}
              />
            ))}
          </div>
          {specialAwards.some((a) => a.player) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {specialAwards.map((a) => (
                <SpecialAwardCard
                  key={a.key}
                  label={a.label}
                  icon={a.icon}
                  color={a.color}
                  person={a.player}
                />
              ))}
            </div>
          )}
        </section>

        {/* TIMES PARTICIPANTES (clicável → estatísticas do time) */}
        {data.teams.length > 0 && (
          <section>
            <SectionHeader
              icon="shield"
              color={ACCENT.draw}
              title="Times na disputa"
              hint="clique para ver as estatísticas"
            />
            <TeamStatsSection teams={teamStats} />
          </section>
        )}

        {/* NOTÍCIAS */}
        <section>
          <SectionHeader icon="envelope" color={ACCENT.win} title="Notícias da copa" />
          {data.messages.length === 0 ? (
            <p className="text-sm text-faint">Sem notícias publicadas.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {data.messages.map((m, i) => (
                <li
                  key={i}
                  className="whitespace-pre-wrap rounded-r-lg border-l-2 border-win bg-panel/40 px-4 py-3 text-sm"
                >
                  {m.body}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
