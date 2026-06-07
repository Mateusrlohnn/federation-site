"use client";

import { useState } from "react";
import Icon, { ICONS } from "@/components/ui/Icon";
import { ACCENT, ProportionBar } from "@/components/ui/stats";
import { focusStyle } from "@/lib/imageFocus";
import maxwidth from "@/styles/maxwidth.module.css";
import TeamDetailModal, {
  type TeamDetail,
  type CupEntry,
} from "@/components/teams/TeamDetailModal";

const stats: { key: keyof TeamDetail; label: string; icon: keyof typeof ICONS; color: string }[] = [
  { key: "titles", label: "Títulos", icon: "trophy", color: ACCENT.gold },
  { key: "runnerUps", label: "Vices", icon: "note-sticky", color: ACCENT.draw },
  { key: "wins", label: "Vitórias", icon: "circle-check", color: ACCENT.win },
  { key: "losses", label: "Derrotas", icon: "shield", color: ACCENT.loss },
];

export default function TeamsView({
  teams,
  cups,
}: {
  teams: TeamDetail[];
  cups: CupEntry[];
}) {
  const [selected, setSelected] = useState<TeamDetail | null>(null);

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      <div className="mb-4 flex w-full flex-col rounded-lg bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon name="shield" className="text-gold" />
          Times
        </h1>
        <span className="mt-1 text-faint">
          {teams.length > 0
            ? `${teams.length} times na Federação Rebug. Clique em um time para ver o histórico.`
            : "Os times da Federação Rebug."}
        </span>
      </div>

      {teams.length === 0 ? (
        <p className="mt-6 text-center text-faint">No teams registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const activeCount = t.roster.filter((m) => m.active).length;
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="group relative flex flex-col overflow-hidden rounded-xl bg-card text-left ring-1 ring-white/5 transition-all duration-200 hover:-translate-y-1 hover:ring-gold/40 hover:shadow-[0_12px_30px_-12px_rgba(255,179,0,0.45)]"
              >
                {/* Cabeçalho com brasão em destaque sobre fundo desfocado */}
                <div className="relative flex h-28 items-center gap-3 overflow-hidden px-5">
                  {t.logo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={t.logo}
                        alt=""
                        aria-hidden
                        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-card/20" />
                      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-panel/80 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={t.logo}
                          alt={t.name}
                          className="h-full w-full object-cover"
                          style={focusStyle(t.logo)}
                        />
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-br from-panel to-base" />
                      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-panel/80 ring-1 ring-white/10">
                        <Icon name="shield" className="text-2xl text-faint" />
                      </span>
                    </>
                  )}
                  <h3 className="relative flex-1 text-xl font-extrabold tracking-tight text-shadow-lg">
                    {t.name}
                  </h3>
                  {t.titles > 0 && (
                    <span className="relative shrink-0 rounded-md bg-gold px-2 py-0.5 text-xs font-bold text-[#1a1a1e]">
                      {t.titles}× <Icon name="trophy" />
                    </span>
                  )}
                </div>

                <div className="flex flex-col px-5 pb-4">
                  {/* Barra de proporção Vitórias / Derrotas */}
                  <ProportionBar
                    segments={[
                      { value: t.wins, color: ACCENT.win, title: "Vitórias" },
                      { value: t.draws, color: ACCENT.draw, title: "Empates" },
                      { value: t.losses, color: ACCENT.loss, title: "Derrotas" },
                    ]}
                  />
                  <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide">
                    <span className="text-win">{t.wins} V</span>
                    <span className="text-draw">{t.draws} E</span>
                    <span className="text-loss">{t.losses} D</span>
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

                  {/* Resumo do elenco */}
                  <div className="mt-3 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-faint">
                    <span>Elenco: {activeCount}</span>
                    <span className="text-gold opacity-0 transition-opacity group-hover:opacity-100">
                      Ver histórico →
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <TeamDetailModal team={selected} cups={cups} onClose={() => setSelected(null)} />
    </div>
  );
}
