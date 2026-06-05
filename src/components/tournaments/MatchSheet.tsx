"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { avatarUrl } from "@/lib/hof";
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
export type SheetData = {
  home: SheetSide;
  away: SheetSide;
  playedAt: string | null;
  mvpName: string | null;
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
            <img src={side.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Icon name="shield" className="text-faint" />
          )}
        </span>
        <span className="flex-1 truncate text-base font-bold">{side.name}</span>
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
              <span className="min-w-0 flex-1 truncate text-right text-lg font-bold">
                {sheet.home.name}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-4xl font-extrabold tabular-nums">
                {sheet.home.score}
                <span className="text-xl text-faint">×</span>
                {sheet.away.score}
              </span>
              <span className="min-w-0 flex-1 truncate text-lg font-bold">{sheet.away.name}</span>
            </div>
            <div className="mt-1 flex items-center justify-center gap-3 text-xs text-faint">
              {sheet.playedAt && <span>{sheet.playedAt}</span>}
              {sheet.mvpName && (
                <span className="font-bold text-gold">⭐ MVP: {sheet.mvpName}</span>
              )}
            </div>

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
