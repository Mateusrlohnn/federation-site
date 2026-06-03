"use client";

import { useState } from "react";
import Icon, { ICONS } from "@/components/ui/Icon";
import { ACCENT, PerfBar, ResultBlock } from "@/components/ui/stats";
import maxwidth from "@/styles/maxwidth.module.css";
import { avatarUrl, type HofPlayer, type StatKey } from "@/lib/hof";

const boards: { key: StatKey | "points"; label: string; icon: keyof typeof ICONS; color: string }[] = [
  { key: "points", label: "Pontos", icon: "trophy", color: ACCENT.gold },
  { key: "titles", label: "Títulos", icon: "circle-check", color: ACCENT.win },
  { key: "mvp", label: "MVP", icon: "futbol", color: ACCENT.draw },
  { key: "runnerUps", label: "Vices", icon: "note-sticky", color: ACCENT.loss },
];

const podiumAccent = ["#ffb300", "#c7ccd1", "#cd7f32"]; // ouro, prata, bronze

export default function PlayersView({ players }: { players: HofPlayer[] }) {
  const [q, setQ] = useState("");
  const ranked = [...players].sort((a, b) => b.points - a.points);
  const rows = ranked.map((p, i) => ({ p, rank: i + 1 }));
  const filtered = rows.filter(({ p }) => p.name.toLowerCase().includes(q.toLowerCase().trim()));

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      {/* Cabeçalho de perfil */}
      <div className="mb-4 flex w-full flex-col rounded-lg bg-card p-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Icon name="trophy" className="text-gold" />
          Hall of Fame
        </h1>
        <span className="mt-1 max-w-[520px] text-faint">
          Ranking histórico dos jogadores da Federação Rebug por pontuação.{" "}
          <b className="text-white">{ranked.length} jogadores</b> registrados.
        </span>
      </div>

      {/* Pódio — top 3 */}
      <div className="mb-4 grid grid-cols-3 gap-2 md:gap-4">
        {ranked.slice(0, 3).map(({ name, points }, i) => (
          <div
            key={name}
            className="relative flex flex-col items-center rounded-lg bg-card p-3 pt-6"
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
          </div>
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
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for a player..."
        className="mb-4 w-full rounded-md bg-panel p-2.5 text-xs text-white placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-gold/50"
      />

      {/* Tabela de Histórico (ranking completo) */}
      {filtered.length === 0 ? (
        <div className="rounded-lg bg-card p-4 text-faint">No players found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-card">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] uppercase tracking-wide text-faint">
              <tr>
                <th className="px-3 py-2.5 font-semibold">#</th>
                <th className="px-3 py-2.5 font-semibold">Jogador</th>
                <th className="px-2 py-2.5 text-center font-semibold">Tít</th>
                <th className="px-2 py-2.5 text-center font-semibold">Vic</th>
                <th className="px-2 py-2.5 text-center font-semibold">MVP</th>
                <th className="px-2 py-2.5 text-center font-semibold">T1</th>
                <th className="px-2 py-2.5 text-center font-semibold">T2</th>
                <th className="px-2 py-2.5 text-center font-semibold">T3</th>
                <th className="px-3 py-2.5 text-right font-semibold">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ p, rank }) => (
                <tr key={p.name} className="hover:bg-panel/60">
                  <td className="px-3 py-2 font-mono text-faint">{rank}</td>
                  <td className="px-3 py-2 font-semibold">
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-6 shrink-0 items-end justify-center overflow-hidden rounded bg-panel">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarUrl(p.name)}
                          alt={p.name}
                          className="h-[34px] w-6 object-contain"
                        />
                      </span>
                      {p.name}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-faint">{p.titles}</td>
                  <td className="px-2 py-2 text-center text-faint">{p.runnerUps}</td>
                  <td className="px-2 py-2 text-center text-faint">{p.mvp}</td>
                  <td className="px-2 py-2 text-center text-faint">{p.top1}</td>
                  <td className="px-2 py-2 text-center text-faint">{p.top2}</td>
                  <td className="px-2 py-2 text-center text-faint">{p.top3}</td>
                  <td className="px-3 py-2 text-right">
                    <ResultBlock value={p.points} color={ACCENT.gold} textClass="text-[#1a1a1e]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[10px] text-faint">
        Pontos incluem estatísticas de Academy (Títulos, MVP, Vices e Top 1–3).
      </p>
    </div>
  );
}
