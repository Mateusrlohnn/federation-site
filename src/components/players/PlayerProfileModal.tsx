"use client";

import { useEffect } from "react";
import { ACCENT } from "@/components/ui/stats";
import { avatarUrl, STAT_FIELDS, type HofPlayer } from "@/lib/hof";
import { POSITIONS } from "@/lib/teams";

/**
 * Perfil de Jogador Detalhado — modal somente de apresentação.
 * Recebe o jogador já selecionado (via estado existente da PlayersView) e o
 * monta inteiramente a partir dos campos reais do HofPlayer. Não busca dados
 * novos nem altera nenhuma lógica/rota/API.
 *
 * Layout horizontal em colunas para caber tudo sem rolagem.
 */

const FAINT = "#8a8a93";

// Tier derivado da pontuação (apenas visual). Verde = A/A+, Ouro = S/S+.
function tierFor(points: number): { label: string; color: string } {
  if (points >= 600) return { label: "S+", color: ACCENT.gold };
  if (points >= 400) return { label: "S", color: ACCENT.gold };
  if (points >= 250) return { label: "A+", color: ACCENT.win };
  if (points >= 120) return { label: "A", color: ACCENT.win };
  if (points >= 50) return { label: "B", color: ACCENT.draw };
  return { label: "C", color: FAINT };
}

function Block({
  value,
  color,
  dark = false,
}: {
  value: React.ReactNode;
  color: string;
  dark?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-base font-bold ${
        dark ? "text-[#1a1a1e]" : "text-white"
      }`}
      style={{ backgroundColor: color }}
    >
      {value}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">{children}</h3>
  );
}

export default function PlayerProfileModal({
  player,
  rank,
  onClose,
}: {
  player: HofPlayer | null;
  rank: number;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!player) return null;

  const main = STAT_FIELDS.slice(0, 6); // titles, vices, mvp, top1, top2, top3
  const podiums = player.top1 + player.top2 + player.top3;
  const tier = tierFor(player.points);

  const statCards = [
    { label: "Pontos", value: player.points, color: ACCENT.gold },
    { label: "Títulos", value: player.titles, color: ACCENT.win },
    { label: "MVP", value: player.mvp, color: ACCENT.draw },
    { label: "Vices", value: player.runnerUps, color: ACCENT.loss },
    { label: "Top 1", value: player.top1, color: ACCENT.win },
    { label: "Pódios", value: podiums, color: ACCENT.gold },
  ];

  const perf = main.map((f) => ({ label: f.label, value: player[f.key] as number }));
  const perfMax = Math.max(1, ...perf.map((x) => x.value));

  const awards = STAT_FIELDS.map((f) => ({ label: f.label, value: player[f.key] as number })).filter(
    (a) => a.value > 0,
  );

  const categories = [
    { label: "Principal", titles: player.titles, mvp: player.mvp, vices: player.runnerUps },
    {
      label: "Academy",
      titles: player.titlesAcademy,
      mvp: player.mvpAcademy,
      vices: player.runnerUpsAcademy,
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Perfil de ${player.name}`}
      onClick={onClose}
      className="animate-overlay-in fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in relative max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-card p-6"
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md bg-panel text-lg text-faint hover:text-white"
        >
          ✕
        </button>

        {/* 1.2 Cabeçalho de perfil (largura total) */}
        <div className="animate-content-in flex items-center gap-4 pr-10" style={{ animationDelay: "60ms" }}>
          <div className="flex h-20 w-16 shrink-0 items-end justify-center overflow-hidden rounded-md bg-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl(player.nick || player.name)}
              alt={player.name}
              className="h-[88px] w-16 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{player.name}</h2>
            <p className="mt-0.5 text-base font-semibold text-gold">Ranking #{rank}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded-md px-3 py-1 text-base font-extrabold text-[#1a1a1e]"
                style={{ backgroundColor: tier.color }}
              >
                {tier.label}
              </span>
              <span className="rounded-md bg-panel px-3 py-1 text-base font-bold">#{rank}</span>
              {player.position && (
                <span
                  className="rounded-md bg-panel px-3 py-1 text-base font-bold text-win"
                  title={POSITIONS.find((p) => p.key === player.position)?.label}
                >
                  {POSITIONS.find((p) => p.key === player.position)?.sigla}
                </span>
              )}
              {player.titles > 0 && (
                <span className="rounded-md bg-gold px-3 py-1 text-base font-bold text-[#1a1a1e]">
                  {player.titles}× 🏆
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 self-start text-right">
            <div className="text-3xl font-bold text-gold">{player.points}</div>
            <div className="text-xs uppercase tracking-wide text-faint">pontos</div>
          </div>
        </div>

        {/* Colunas de dados — tudo visível sem rolagem */}
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Coluna 1: proporção + estatísticas */}
          <div className="animate-content-in flex flex-col gap-5" style={{ animationDelay: "140ms" }}>
            <section>
              <SectionTitle>Distribuição de pódios</SectionTitle>
              {podiums === 0 ? (
                <div className="flex h-9 w-full items-center justify-center rounded-md bg-panel text-sm font-semibold text-faint">
                  Sem pódios registrados
                </div>
              ) : (
                <div className="flex h-9 w-full overflow-hidden rounded-md bg-panel">
                  {[
                    { v: player.top1, c: ACCENT.win, t: "Top 1" },
                    { v: player.top2, c: ACCENT.draw, t: "Top 2" },
                    { v: player.top3, c: ACCENT.loss, t: "Top 3" },
                  ]
                    .filter((s) => s.v > 0)
                    .map((s) => (
                      <div
                        key={s.t}
                        title={s.t}
                        className="flex items-center justify-center text-sm font-bold text-white"
                        style={{ width: `${(s.v / podiums) * 100}%`, backgroundColor: s.c }}
                      >
                        {s.v}
                      </div>
                    ))}
                </div>
              )}
              <div className="mt-1 flex justify-between text-xs font-semibold uppercase tracking-wide">
                <span className="text-win">Top 1</span>
                <span className="text-draw">Top 2</span>
                <span className="text-loss">Top 3</span>
              </div>
            </section>

            <section>
              <SectionTitle>Estatísticas</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {statCards.map((s) => (
                  <div key={s.label} className="rounded-md bg-panel px-3 py-3 text-center">
                    <div className="text-3xl font-extrabold" style={{ color: s.color }}>
                      {s.value}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-faint">{s.label}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Coluna 2: histórico de desempenho */}
          <section className="animate-content-in" style={{ animationDelay: "220ms" }}>
            <SectionTitle>Histórico de desempenho</SectionTitle>
            <div className="flex flex-col gap-2">
              {perf.map((p) => {
                const isTop = p.value === perfMax && p.value > 0;
                const pct = p.value > 0 ? Math.max((p.value / perfMax) * 100, 10) : 0;
                return (
                  <div key={p.label} className="flex items-center gap-3">
                    <div className="relative h-8 flex-1 overflow-hidden rounded-md bg-panel">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isTop ? ACCENT.gold : ACCENT.win,
                          opacity: 0.9,
                        }}
                      />
                      <div className="relative flex h-full items-center px-3 text-sm font-semibold text-white">
                        {p.label}
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right text-lg font-bold tabular-nums">
                      {p.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Coluna 3: prêmios + histórico por categoria */}
          <div className="animate-content-in flex flex-col gap-5" style={{ animationDelay: "300ms" }}>
            <section>
              <SectionTitle>Prêmios individuais</SectionTitle>
              {awards.length === 0 ? (
                <p className="text-sm text-faint">Nenhum prêmio registrado.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                  {awards.map((a) => (
                    <div
                      key={a.label}
                      className="flex flex-col items-center justify-center rounded-md bg-gold px-2 py-2.5 text-center text-[#1a1a1e]"
                    >
                      <span className="text-lg font-extrabold leading-none">{a.value}×</span>
                      <span className="mt-1 text-xs font-bold leading-tight">{a.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Histórico por categoria</SectionTitle>
              <div className="flex flex-col gap-1.5">
                {categories.map((c) => (
                  <div
                    key={c.label}
                    className="flex items-center justify-between rounded-md bg-panel px-3 py-2"
                  >
                    <span className="text-base font-semibold">{c.label}</span>
                    <span className="flex items-center gap-1.5">
                      <Block value={c.titles} color={ACCENT.win} />
                      <Block value={c.mvp} color={ACCENT.gold} dark />
                      <Block value={c.vices} color={ACCENT.loss} />
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-end gap-1.5 pr-1 text-[11px] font-semibold uppercase tracking-wide">
                <span className="text-win">Títulos</span>
                <span className="text-gold">MVP</span>
                <span className="text-loss">Vices</span>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
