"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { ACCENT } from "@/components/ui/stats";
import { avatarUrl } from "@/lib/hof";

/**
 * "Times na disputa" — chips clicáveis que abrem um modal com as estatísticas
 * do time DENTRO do torneio. Somente apresentação (dados preparados na tela).
 */

export type StatLeader = { name: string; value: number } | null;
export type TeamMatchLine = {
  opponent: string;
  opponentLogo: string;
  forScore: number;
  againstScore: number;
  result: "win" | "loss" | "draw";
  date: string | null;
};
export type TeamUpcoming = { opponent: string; opponentLogo: string; date: string | null };
export type TeamStat = {
  id: string;
  name: string;
  logo: string;
  isChampion: boolean;
  wins: number;
  losses: number;
  draws: number;
  topScorer: StatLeader;
  topAssister: StatLeader;
  topYellow: StatLeader;
  topRed: StatLeader;
  lineup: { sigla: string; names: string[] }[];
  last: TeamMatchLine[];
  upcoming: TeamUpcoming[];
};

function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-end justify-center overflow-hidden rounded bg-base"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarUrl(name)}
        alt={name}
        className="object-contain"
        style={{ width: size, height: size * 1.25 }}
      />
    </span>
  );
}

function TeamLogo({ logo, size = 40 }: { logo: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-base"
      style={{ width: size, height: size }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name="shield" className="text-faint" />
      )}
    </span>
  );
}

function Leader({
  label,
  emoji,
  leader,
  color,
}: {
  label: string;
  emoji: string;
  leader: StatLeader;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-panel/60 p-3">
      <span className="text-[10px] font-bold uppercase tracking-wide text-faint">
        {emoji} {label}
      </span>
      {leader ? (
        <div className="flex items-center gap-2">
          <Avatar name={leader.name} size={28} />
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{leader.name}</span>
          <span className="text-lg font-extrabold" style={{ color }}>
            {leader.value}
          </span>
        </div>
      ) : (
        <span className="text-sm text-faint">—</span>
      )}
    </div>
  );
}

function StatModal({ t, onClose }: { t: TeamStat; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Estatísticas de ${t.name}`}
      onClick={onClose}
      className="animate-overlay-in fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-card p-6"
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md bg-panel text-lg text-faint hover:text-white"
        >
          ✕
        </button>

        {/* cabeçalho */}
        <div className="flex items-center gap-3 pr-10">
          <TeamLogo logo={t.logo} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 truncate text-2xl font-extrabold tracking-tight">
              {t.name}
              {t.isChampion && <Icon name="trophy" className="text-gold" />}
            </h2>
            <div className="mt-1 flex gap-2 text-xs font-bold">
              <span className="rounded-md px-2 py-0.5" style={{ backgroundColor: `${ACCENT.win}22`, color: ACCENT.win }}>
                {t.wins} V
              </span>
              <span className="rounded-md px-2 py-0.5" style={{ backgroundColor: `${ACCENT.loss}22`, color: ACCENT.loss }}>
                {t.losses} D
              </span>
              <span className="rounded-md bg-panel px-2 py-0.5 text-faint">{t.draws} E</span>
            </div>
          </div>
        </div>

        {/* líderes */}
        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Leader label="Artilheiro" emoji="⚽" leader={t.topScorer} color={ACCENT.gold} />
          <Leader label="+ Assistências" emoji="👟" leader={t.topAssister} color={ACCENT.draw} />
          <Leader label="+ Amarelos" emoji="🟨" leader={t.topYellow} color="#ffd600" />
          <Leader label="+ Vermelhos" emoji="🟥" leader={t.topRed} color={ACCENT.loss} />
        </div>

        {/* elenco por posição */}
        <section className="mt-6">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">
            Jogadores por posição
          </h3>
          {t.lineup.length === 0 ? (
            <p className="text-sm text-faint">Sem elenco registrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {t.lineup.map((g) => (
                <div key={g.sigla} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex min-w-12 shrink-0 items-center justify-center rounded-md bg-gold px-2 py-1 text-xs font-extrabold text-[#1a1a1e]">
                    {g.sigla}
                  </span>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {g.names.map((n) => (
                      <span
                        key={n}
                        className="flex items-center gap-1.5 rounded-md bg-panel py-0.5 pl-0.5 pr-2 text-sm"
                      >
                        <Avatar name={n} />
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {/* últimas partidas */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">
              Últimas partidas
            </h3>
            {t.last.length === 0 ? (
              <p className="text-sm text-faint">Nenhuma partida disputada.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {t.last.map((m, i) => {
                  const color =
                    m.result === "win" ? ACCENT.win : m.result === "loss" ? ACCENT.loss : "#8a8a93";
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-md bg-panel/60 px-3 py-2 text-sm"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-extrabold text-[#1a1a1e]"
                        style={{ backgroundColor: color }}
                      >
                        {m.result === "win" ? "V" : m.result === "loss" ? "D" : "E"}
                      </span>
                      <span className="font-bold tabular-nums">
                        {m.forScore} × {m.againstScore}
                      </span>
                      <TeamLogo logo={m.opponentLogo} size={20} />
                      <span className="min-w-0 flex-1 truncate text-faint">{m.opponent}</span>
                      {m.date && <span className="shrink-0 text-[10px] text-faint">{m.date}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* próximas partidas */}
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">
              Próximas partidas
            </h3>
            {t.upcoming.length === 0 ? (
              <p className="text-sm text-faint">Nenhuma partida agendada.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {t.upcoming.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-md bg-panel/60 px-3 py-2 text-sm"
                  >
                    <Icon name="trophy" className="text-faint" />
                    <span className="text-faint">vs</span>
                    <TeamLogo logo={m.opponentLogo} size={20} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{m.opponent}</span>
                    {m.date && <span className="shrink-0 text-[10px] text-faint">{m.date}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function TeamStatsSection({ teams }: { teams: TeamStat[] }) {
  const [selected, setSelected] = useState<TeamStat | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        {teams.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t)}
            className="flex items-center gap-2.5 rounded-full bg-panel/60 py-1 pl-1 pr-4 text-sm font-bold transition-colors hover:bg-panel"
            style={t.isChampion ? { boxShadow: `inset 0 0 0 1.5px ${ACCENT.gold}` } : undefined}
          >
            <TeamLogo logo={t.logo} size={32} />
            {t.name}
            {t.isChampion && <Icon name="trophy" className="text-gold" />}
          </button>
        ))}
      </div>

      {selected && <StatModal t={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
