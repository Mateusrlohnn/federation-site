"use client";

import { useState } from "react";
import Icon, { ICONS } from "@/components/ui/Icon";
import { ACCENT, PerfBar } from "@/components/ui/stats";
import PlayerProfileModal from "@/components/players/PlayerProfileModal";
import PlayerComparisonModal from "@/components/players/PlayerComparisonModal";
import maxwidth from "@/styles/maxwidth.module.css";
import { avatarUrl, type HofPlayer, type StatKey } from "@/lib/hof";

const boards: { key: StatKey | "points"; label: string; icon: keyof typeof ICONS; color: string }[] = [
  { key: "points", label: "Pontos", icon: "trophy", color: ACCENT.gold },
  { key: "titles", label: "Títulos", icon: "circle-check", color: ACCENT.win },
  { key: "mvp", label: "MVP", icon: "futbol", color: ACCENT.draw },
  { key: "runnerUps", label: "Vices", icon: "note-sticky", color: ACCENT.loss },
];

const podiumAccent = ["#ffb300", "#c7ccd1", "#cd7f32"]; // ouro, prata, bronze

const PAGE_SIZE = 10;

/** Páginas visíveis no paginador: tudo até 7, senão janela com reticências. */
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

export default function PlayersView({ players }: { players: HofPlayer[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ p: HofPlayer; rank: number } | null>(null);
  const [comparing, setComparing] = useState(false);
  const ranked = [...players].sort((a, b) => b.points - a.points);
  const rows = ranked.map((p, i) => ({ p, rank: i + 1 }));
  const filtered = rows.filter(({ p }) => p.name.toLowerCase().includes(q.toLowerCase().trim()));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pages = pageWindow(safePage, totalPages);

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      {/* Cabeçalho de perfil */}
      <div className="mb-4 flex w-full flex-col gap-4 rounded-lg bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Icon name="trophy" className="text-gold" />
            Hall of Fame
          </h1>
          <span className="mt-1 max-w-[520px] text-faint">
            Ranking histórico dos jogadores da Federação Rebug por pontuação.{" "}
            <b className="text-white">{ranked.length} jogadores</b> registrados.
          </span>
        </div>
        <button
          onClick={() => setComparing(true)}
          className="flex shrink-0 items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-bold text-[#1a1a1e] transition-transform hover:scale-[1.03] active:scale-100"
        >
          <Icon name="handshake-angle" />
          Comparar Jogadores
        </button>
      </div>

      {/* Pódio — top 3 */}
      <div className="mb-4 grid grid-cols-3 gap-2 md:gap-4">
        {ranked.slice(0, 3).map(({ name, points }, i) => (
          <button
            key={name}
            onClick={() => setSelected({ p: ranked[i], rank: i + 1 })}
            className="relative flex flex-col items-center rounded-lg bg-card p-3 pt-6 text-center transition-colors hover:bg-panel"
            style={{ boxShadow: `inset 0 2px 0 0 ${podiumAccent[i]}` }}
          >
            <span
              className="absolute left-3 top-2 text-xs font-bold"
              style={{ color: podiumAccent[i] }}
            >
              #{i + 1}
            </span>
            <div className="flex h-[80px] w-[64px] items-end justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl(name)} alt={name} className="h-[100px] w-[64px] object-contain" />
            </div>
            <span className="mt-2 text-sm font-bold">{name}</span>
            <span className="text-sm font-bold text-gold">{points} pts</span>
          </button>
        ))}
      </div>

      {/* Barras de Histórico de Performance (leaderboards por estatística) */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {boards.map((board) => {
          const top = [...ranked]
            .sort((a, b) => (b[board.key] as number) - (a[board.key] as number))
            .slice(0, 5);
          const max = (top[0]?.[board.key] as number) ?? 0;
          return (
            <div key={board.label} className="rounded-lg bg-card p-3">
              <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                <Icon name={board.icon} style={{ color: board.color }} />
                {board.label}
              </h2>
              <div className="flex flex-col gap-1.5">
                {top.map((p, i) => (
                  <PerfBar
                    key={p.name}
                    value={p[board.key] as number}
                    max={max}
                    color={board.color}
                    label={
                      <>
                        <span className="mr-1.5 text-faint">{i + 1}</span>
                        {p.name}
                      </>
                    }
                    trailing={p[board.key] as number}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Busca */}
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder="Search for a player..."
        className="mb-4 w-full rounded-md bg-panel p-2.5 text-xs text-white placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-gold/50"
      />

      {/* Tabela de Histórico (ranking completo, paginado) */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-card p-4 text-faint">No players found.</div>
      ) : (
        <div className="overflow-hidden rounded-lg bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-faint">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Jogador</th>
                  <th className="px-2 py-3 text-center font-semibold">Tít</th>
                  <th className="px-2 py-3 text-center font-semibold">Vic</th>
                  <th className="px-2 py-3 text-center font-semibold">MVP</th>
                  <th className="px-2 py-3 text-center font-semibold">T1</th>
                  <th className="px-2 py-3 text-center font-semibold">T2</th>
                  <th className="px-2 py-3 text-center font-semibold">T3</th>
                  <th className="px-4 py-3 text-right font-semibold">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ p, rank }, i) => {
                  const medal =
                    rank === 1
                      ? "#ffb300"
                      : rank === 2
                        ? "#c7ccd1"
                        : rank === 3
                          ? "#cd7f32"
                          : undefined;
                  return (
                    <tr
                      key={p.name}
                      className={`border-b border-white/5 transition-colors last:border-0 hover:bg-panel/50 ${
                        i % 2 ? "bg-panel/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-base font-bold"
                          style={{ color: medal ?? "#8a8a93" }}
                        >
                          {rank}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <button
                          onClick={() => setSelected({ p, rank })}
                          className="group flex items-center gap-3 text-left transition-colors hover:text-gold"
                          title={`Ver perfil de ${p.name}`}
                        >
                          <span className="flex h-11 w-9 shrink-0 items-end justify-center overflow-hidden rounded-md bg-panel ring-gold/0 transition-all duration-200 group-hover:ring-2 group-hover:ring-gold/60">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatarUrl(p.name)}
                              alt={p.name}
                              className="h-[52px] w-9 object-contain transition-transform duration-200 ease-out group-hover:scale-110"
                            />
                          </span>
                          <span className="text-[15px] transition-transform duration-200 group-hover:translate-x-0.5">
                            {p.name}
                          </span>
                        </button>
                      </td>
                      <td className="px-2 py-3 text-center text-faint">{p.titles}</td>
                      <td className="px-2 py-3 text-center text-faint">{p.runnerUps}</td>
                      <td className="px-2 py-3 text-center text-faint">{p.mvp}</td>
                      <td className="px-2 py-3 text-center text-faint">{p.top1}</td>
                      <td className="px-2 py-3 text-center text-faint">{p.top2}</td>
                      <td className="px-2 py-3 text-center text-faint">{p.top3}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex h-8 min-w-12 items-center justify-center rounded-md bg-gold px-2 text-base font-bold text-[#1a1a1e]">
                          {p.points}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginador */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
              <span className="text-xs text-faint">
                {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de{" "}
                {filtered.length} jogadores
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 1}
                  aria-label="Página anterior"
                  className="flex h-8 min-w-8 items-center justify-center rounded-md bg-panel px-2 text-sm hover:bg-panel/70 disabled:opacity-40"
                >
                  ‹
                </button>
                {pages.map((n, idx) =>
                  n === "…" ? (
                    <span key={`e${idx}`} className="px-1.5 text-faint">
                      …
                    </span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n)}
                      className={`h-8 min-w-8 rounded-md px-2 text-sm transition-colors ${
                        n === safePage
                          ? "bg-gold font-bold text-[#1a1a1e]"
                          : "bg-panel hover:bg-panel/70"
                      }`}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  aria-label="Próxima página"
                  className="flex h-8 min-w-8 items-center justify-center rounded-md bg-panel px-2 text-sm hover:bg-panel/70 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-[10px] text-faint">
        Pontos incluem estatísticas de Academy (Títulos, MVP, Vices e Top 1–3).
      </p>

      <PlayerProfileModal
        player={selected?.p ?? null}
        rank={selected?.rank ?? 0}
        onClose={() => setSelected(null)}
      />

      {comparing && (
        <PlayerComparisonModal players={players} onClose={() => setComparing(false)} />
      )}
    </div>
  );
}
