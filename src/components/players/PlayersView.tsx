"use client";

import { useState } from "react";
import Icon, { ICONS } from "@/components/ui/Icon";
import maxwidth from "@/styles/maxwidth.module.css";
import { avatarUrl, type HofPlayer, type StatKey } from "@/lib/hof";

const boards: { key: StatKey | "points"; label: string; icon: keyof typeof ICONS; color: string }[] = [
  { key: "points", label: "Pontos", icon: "trophy", color: "text-yellow-500" },
  { key: "titles", label: "Títulos", icon: "circle-check", color: "text-green-500" },
  { key: "mvp", label: "MVP", icon: "futbol", color: "text-blue-500" },
  { key: "runnerUps", label: "Vices", icon: "note-sticky", color: "text-red-500" },
];

export default function PlayersView({ players }: { players: HofPlayer[] }) {
  const [q, setQ] = useState("");
  const ranked = [...players].sort((a, b) => b.points - a.points);
  const rows = ranked.map((p, i) => ({ p, rank: i + 1 }));
  const filtered = rows.filter(({ p }) => p.name.toLowerCase().includes(q.toLowerCase().trim()));

  return (
    <div className={maxwidth.maxWidthContainer} style={{ height: "auto", position: "static" }}>
      {/* Header card */}
      <div className="flex flex-col justify-between p-4 mb-4 w-full bg-[#2f2f2f] border border-[#454545] rounded-xl">
        <h1 className="text-xl font-bold">
          <Icon name="trophy" className="text-yellow-500 mr-2" />
          Hall of Fame
        </h1>
        <span className="mt-2 max-w-[520px] text-[#cfcfcf]">
          Ranking histórico dos jogadores da Federação Rebug por pontuação.{" "}
          <b>{ranked.length} jogadores</b> registrados.
        </span>
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
        {ranked.slice(0, 3).map(({ name, points }, i) => (
          <div
            key={name}
            className="flex flex-col items-center bg-[#2f2f2f] border border-[#454545] rounded-xl p-3 pt-6 relative"
          >
            <span
              className={`absolute top-2 left-2 text-xs font-bold ${
                i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-300" : "text-amber-700"
              }`}
            >
              #{i + 1}
            </span>
            <div className="h-[80px] w-[64px] overflow-hidden flex items-end justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarUrl(name)} alt={name} className="h-[100px] w-[64px] object-contain" />
            </div>
            <span className="mt-2 font-bold text-sm">{name}</span>
            <span className="text-yellow-500 font-bold text-sm">{points} pts</span>
          </div>
        ))}
      </div>

      {/* Leaderboards */}
      <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {boards.map((board) => {
          const top = [...ranked]
            .sort((a, b) => (b[board.key] as number) - (a[board.key] as number))
            .slice(0, 5);
          return (
            <div key={board.label} className="rounded-lg bg-[#2f2f2f] border border-[#454545] pb-2">
              <h2 className="px-2 py-3 font-bold text-xs border-b border-[#454545]">
                <Icon name={board.icon} className={`mr-1 ${board.color}`} />
                {board.label}
              </h2>
              <ul className="px-2 pt-2 space-y-1.5">
                {top.map((p, i) => (
                  <li key={p.name} className="flex items-center justify-between">
                    <span className="truncate">
                      <span className="text-[#8d8d8d] mr-1">{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="font-mono text-[#cfcfcf]">{p[board.key] as number}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search for a player..."
        className="text-xs border border-[#8d8d8d68] p-2 rounded mb-4 w-full"
      />

      {/* Ranking table */}
      {filtered.length === 0 ? (
        <div className="p-4">No players found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#454545]">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#2f2f2f] text-[#cfcfcf]">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Jogador</th>
                <th className="px-2 py-2 text-center">Tít</th>
                <th className="px-2 py-2 text-center">Vic</th>
                <th className="px-2 py-2 text-center">MVP</th>
                <th className="px-2 py-2 text-center">T1</th>
                <th className="px-2 py-2 text-center">T2</th>
                <th className="px-2 py-2 text-center">T3</th>
                <th className="px-3 py-2 text-right">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ p, rank }) => (
                <tr key={p.name} className="border-t border-[#333] hover:bg-[#1d1d1d]">
                  <td className="px-3 py-2 font-mono text-[#8d8d8d]">{rank}</td>
                  <td className="px-3 py-2 font-semibold">{p.name}</td>
                  <td className="px-2 py-2 text-center">{p.titles}</td>
                  <td className="px-2 py-2 text-center">{p.runnerUps}</td>
                  <td className="px-2 py-2 text-center">{p.mvp}</td>
                  <td className="px-2 py-2 text-center">{p.top1}</td>
                  <td className="px-2 py-2 text-center">{p.top2}</td>
                  <td className="px-2 py-2 text-center">{p.top3}</td>
                  <td className="px-3 py-2 text-right font-bold text-yellow-500">{p.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-[#8d8d8d] mt-2">
        Pontos incluem estatísticas de Academy (Títulos, MVP, Vices e Top 1–3).
      </p>
    </div>
  );
}
