"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { avatarUrl } from "@/lib/hof";
import { focusStyle } from "@/lib/imageFocus";
import { gradeClass, type Grade } from "@/lib/tournaments";

/**
 * Súmula completa de uma partida — botão + modal somente de apresentação.
 * Recebe os dados já preparados pela tela da copa (elenco por posição + eventos).
 */

export type SheetPlayer = {
  name: string;
  nick?: string;
  posSigla: string | null;
  goals: number;
  goalMinutes: (number | null)[];
  ownGoals: number;
  penaltyMisses: number;
  assists: number;
  yellow: number;
  red: number;
  rating: Grade | null;
  subbedIn: boolean; // entrou no jogo (substituição)
  subbedOut: boolean; // saiu do jogo (substituição)
  subInMinute: number | null;
  subOutMinute: number | null;
};
export type SheetSide = { name: string; logo: string; score: number; lineup: SheetPlayer[] };
export type SheetShootoutKick = { name: string; nick?: string; scored: boolean };
export type SheetData = {
  home: SheetSide;
  away: SheetSide;
  playedAt: string | null;
  mvpName: string | null;
  // disputa de pênaltis (cobranças na ordem); null quando não houve
  shootout?: { home: SheetShootoutKick[]; away: SheetShootoutKick[] } | null;
  // W.O.: presente quando foi W.O. winner = beneficiado (3×0); winner null = duplo (0×0).
  wo?: { winner: string | null } | null;
};

// Ordem das posições para agrupar o elenco.
const POS_ORDER = ["GK", "ZAG", "MID", "ATK", "—"];

function PlayerAvatar({ name, nick, size = 34 }: { name: string; nick?: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-end justify-center overflow-hidden rounded-lg bg-base"
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

function SheetRow({ p }: { p: SheetPlayer }) {
  const hasEvents =
    p.goals ||
    p.assists ||
    p.yellow ||
    p.red ||
    p.penaltyMisses ||
    p.ownGoals ||
    p.subbedIn ||
    p.subbedOut;
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 odd:bg-white/[0.02]">
      <PlayerAvatar name={p.name} nick={p.nick} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
      <span className="flex flex-wrap items-center justify-end gap-1.5 text-sm">
        {p.subbedIn && (
          <span title="Entrou (substituição)" className="inline-flex items-center gap-0.5 text-win">
            🔺
            {p.subInMinute != null && (
              <span className="font-mono text-[10px]">{p.subInMinute}&apos;</span>
            )}
          </span>
        )}
        {p.subbedOut && (
          <span title="Saiu (substituição)" className="inline-flex items-center gap-0.5 text-loss">
            🔻
            {p.subOutMinute != null && (
              <span className="font-mono text-[10px]">{p.subOutMinute}&apos;</span>
            )}
          </span>
        )}
        {p.goals > 0 && (
          <span title="Gols" className="inline-flex items-center gap-0.5">
            <span>⚽</span>
            {p.goals > 1 && <span className="text-xs font-bold">{p.goals}</span>}
            {p.goalMinutes.some((m) => m != null) && (
              <span className="font-mono text-[10px] text-faint">
                {p.goalMinutes
                  .filter((m) => m != null)
                  .map((m) => `${m}'`)
                  .join(" ")}
              </span>
            )}
          </span>
        )}
        {p.assists > 0 && (
          <span title="Assistências" className="inline-flex items-center gap-0.5">
            👟{p.assists > 1 && <span className="text-xs font-bold">{p.assists}</span>}
          </span>
        )}
        {p.ownGoals > 0 && (
          <span title="Gols contra" className="inline-flex items-center gap-0.5">
            🥅{p.ownGoals > 1 && <span className="text-xs font-bold">{p.ownGoals}</span>}
          </span>
        )}
        {p.penaltyMisses > 0 && (
          <span title="Pênaltis perdidos" className="inline-flex items-center gap-0.5">
            🔴{p.penaltyMisses > 1 && <span className="text-xs font-bold">{p.penaltyMisses}</span>}
          </span>
        )}
        {p.yellow > 0 && (
          <span title="Cartões amarelos" className="inline-flex items-center gap-0.5">
            🟨{p.yellow > 1 && <span className="text-xs font-bold">{p.yellow}</span>}
          </span>
        )}
        {p.red > 0 && (
          <span title="Cartões vermelhos" className="inline-flex items-center gap-0.5">
            🟥{p.red > 1 && <span className="text-xs font-bold">{p.red}</span>}
          </span>
        )}
        {!hasEvents && <span className="text-xs text-faint">—</span>}
      </span>
      {p.rating != null && (
        <span
          title="Nota"
          className={`ml-1 inline-flex min-w-[2.1rem] shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-extrabold ${gradeClass(
            p.rating,
          )}`}
        >
          {p.rating}
        </span>
      )}
    </div>
  );
}

function Lineup({ side }: { side: SheetSide }) {
  // agrupa por posição preservando a ordem GK→ZAG→MID→ATK→sem posição
  const groups = POS_ORDER.map((pos) => ({
    pos,
    players: side.lineup.filter((p) => (p.posSigla ?? "—") === pos),
  })).filter((g) => g.players.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-base">
          {side.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={side.logo} alt="" className="h-full w-full object-cover" style={focusStyle(side.logo)} />
          ) : (
            <Icon name="shield" className="text-faint" />
          )}
        </span>
        <span className="flex-1 truncate text-base font-bold text-white">{side.name}</span>
        <span className="text-2xl font-extrabold tabular-nums">{side.score}</span>
      </div>

      {side.lineup.length === 0 ? (
        <p className="text-sm text-faint">Sem elenco registrado.</p>
      ) : (
        groups.map((g) => (
          <div key={g.pos}>
            <div className="mb-1 inline-flex items-center justify-center rounded bg-panel px-2 py-0.5 text-[10px] font-extrabold text-faint">
              {g.pos === "—" ? "SEM POSIÇÃO" : g.pos}
            </div>
            <div className="flex flex-col">
              {g.players.map((p, i) => (
                <SheetRow key={`${p.name}-${i}`} p={p} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ShootoutKick({ k }: { k: SheetShootoutKick }) {
  return (
    <span
      title={`${k.name} — ${k.scored ? "converteu" : "perdeu"}`}
      className="inline-flex h-6 w-6 cursor-default items-center justify-center"
    >
      {k.scored ? (
        <span className="text-base">⚽</span>
      ) : (
        <span className="relative inline-flex items-center justify-center">
          <span className="text-base">🔴</span>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-white">
            ✕
          </span>
        </span>
      )}
    </span>
  );
}

function ShootoutBlock({ sheet }: { sheet: SheetData }) {
  const s = sheet.shootout;
  if (!s) return null;
  const hg = s.home.filter((k) => k.scored).length;
  const ag = s.away.filter((k) => k.scored).length;
  const Row = ({ name, kicks }: { name: string; kicks: SheetShootoutKick[] }) => (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 truncate text-sm font-semibold sm:w-40">{name}</span>
      <span className="flex flex-wrap items-center gap-0.5">
        {kicks.length ? (
          kicks.map((k, i) => <ShootoutKick key={i} k={k} />)
        ) : (
          <span className="text-xs text-faint">—</span>
        )}
      </span>
    </div>
  );
  return (
    <div className="mt-6 rounded-lg bg-panel/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-faint">
        Decisão por pênaltis
        <span className="font-mono text-sm text-white">
          {hg} × {ag}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Row name={sheet.home.name} kicks={s.home} />
        <Row name={sheet.away.name} kicks={s.away} />
      </div>
      <p className="mt-2 text-[10px] text-faint">
        ⚽ convertido · 🔴✕ perdido — passe o mouse para ver o cobrador.
      </p>
    </div>
  );
}

export default function MatchSheet({ sheet }: { sheet: SheetData }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full border-t border-white/5 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/10"
      >
        Ver súmula completa →
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Súmula completa"
          onClick={() => setOpen(false)}
          className="animate-overlay-in fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-in relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-card p-6"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md bg-panel text-lg text-faint hover:text-white"
            >
              ✕
            </button>

            {/* placar */}
            <div className="flex items-center justify-center gap-4 pr-10 sm:gap-8">
              <span className="min-w-0 flex-1 truncate text-right text-lg font-bold text-white">
                {sheet.home.name}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-4xl font-extrabold tabular-nums">
                {sheet.home.score}
                <span className="text-xl text-faint">×</span>
                {sheet.away.score}
              </span>
              <span className="min-w-0 flex-1 truncate text-lg font-bold text-white">{sheet.away.name}</span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-3 text-xs text-faint">
              {sheet.playedAt && <span>{sheet.playedAt}</span>}
              {sheet.mvpName && (
                <span className="font-bold text-gold">⭐ MVP: {sheet.mvpName}</span>
              )}
            </div>

            {/* W.O. (se foi) */}
            {sheet.wo && (
              <div className="mt-4 rounded-lg border border-loss/30 bg-loss/10 p-3 text-center text-sm">
                <span className="font-extrabold uppercase tracking-wide text-loss">W.O.</span>{" "}
                <span className="text-white">
                  {sheet.wo.winner ? (
                    <>
                      Vitória de <b>{sheet.wo.winner}</b> — adversário não compareceu (3×0).
                    </>
                  ) : (
                    <>Os dois times não compareceram (0×0).</>
                  )}
                </span>
              </div>
            )}

            {/* decisão por pênaltis (se houve) */}
            <ShootoutBlock sheet={sheet} />

            {/* elencos por posição */}
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <Lineup side={sheet.home} />
              <Lineup side={sheet.away} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---- TODAS AS SÚMULAS DO TORNEIO (agrupadas por fase) ----
export type AllSheetsMatch = {
  home: { name: string; logo: string };
  away: { name: string; logo: string };
  homeScore: number;
  awayScore: number;
  playedAt: string | null;
  sheet: SheetData;
};
export type AllSheetsSection = { label: string; matches: AllSheetsMatch[] };

function MiniLogo({ logo }: { logo: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-base">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full object-cover" style={focusStyle(logo)} />
      ) : (
        <Icon name="shield" className="text-[9px] text-faint" />
      )}
    </span>
  );
}

export function AllSheetsButton({ sections }: { sections: AllSheetsSection[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const total = sections.reduce((s, sec) => s + sec.matches.length, 0);
  if (total === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-gold/30 bg-gold/10 py-2.5 text-center text-xs font-bold uppercase tracking-wide text-gold transition-colors hover:bg-gold/20"
      >
        Ver todas as súmulas do torneio ({total}) →
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Todas as súmulas do torneio"
          onClick={() => setOpen(false)}
          className="animate-overlay-in fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-modal-in relative max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6"
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md bg-panel text-lg text-faint hover:text-white"
            >
              ✕
            </button>

            <h2 className="mb-4 pr-10 text-lg font-bold text-white">Súmulas do torneio</h2>

            <div className="flex flex-col gap-5">
              {sections.map((sec) => (
                <div key={sec.label}>
                  <div className="mb-2 inline-flex items-center rounded bg-gold/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-gold">
                    {sec.label}
                  </div>
                  <div className="flex flex-col gap-2">
                    {sec.matches.map((m, i) => {
                      const homeWin = m.homeScore > m.awayScore;
                      const awayWin = m.awayScore > m.homeScore;
                      return (
                        <div key={i} className="overflow-hidden rounded-lg bg-panel/50">
                          <div className="flex items-center gap-2 px-3 py-2 text-sm">
                            <span
                              className={`min-w-0 flex-1 truncate text-right ${homeWin ? "font-bold text-white" : "text-faint"}`}
                            >
                              {m.home.name}
                            </span>
                            <MiniLogo logo={m.home.logo} />
                            <span className="shrink-0 font-mono font-bold tabular-nums">
                              <span style={{ color: homeWin ? "#00e676" : undefined }}>{m.homeScore}</span>
                              <span className="mx-1 text-faint">×</span>
                              <span style={{ color: awayWin ? "#00e676" : undefined }}>{m.awayScore}</span>
                            </span>
                            <MiniLogo logo={m.away.logo} />
                            <span
                              className={`min-w-0 flex-1 truncate ${awayWin ? "font-bold text-white" : "text-faint"}`}
                            >
                              {m.away.name}
                            </span>
                          </div>
                          <MatchSheet sheet={m.sheet} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
