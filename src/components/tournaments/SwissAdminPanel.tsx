"use client";

import { useState } from "react";
import { ACCENT } from "@/components/ui/stats";
import {
  computeSwissRecords,
  generateSwissPairs,
  swissThresholds,
  playedPairs,
  BYE,
} from "@/lib/formats";
import type { Match } from "@/lib/tournaments";

/**
 * Painel interativo do Sistema Suíço (admin) — fluxo por rodada:
 *   1) Sortear rodada  → cria os confrontos (partidas agendadas) por recorde
 *   2) Inserir placares → cada confronto vira resultado e a tabela recalcula
 *   3) Sortear próxima  → quando a rodada termina, sorteia a seguinte
 */

function statusColor(s: string): string {
  if (s === "Classificado") return ACCENT.win;
  if (s === "Eliminado") return ACCENT.loss;
  return "#8a8a93";
}

/** Embaralhamento Fisher-Yates (fora do render — o sorteio é aleatório). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SwissAdminPanel({
  teams,
  matches,
  busy,
  onSaveResult,
  onScheduleRound,
}: {
  teams: { id: string; name: string }[];
  matches: Match[];
  busy: boolean;
  onSaveResult: (
    home: string,
    away: string,
    homeScore: number,
    awayScore: number,
    matchId?: string,
  ) => void;
  onScheduleRound: (pairs: { home: string; away: string }[]) => void;
}) {
  const [scores, setScores] = useState<Record<string, { h: string; a: string }>>({});

  const teamIds = teams.map((t) => t.id);
  const nameById = new Map(teams.map((t) => [t.id, t.name]));
  const name = (id: string) => nameById.get(id) ?? "—";

  if (teamIds.length < 2) {
    return <p className="text-xs text-faint">Vincule ao menos 2 times para usar o sistema suíço.</p>;
  }

  const records = computeSwissRecords(teamIds, matches);
  const { qualifyWins, eliminateLosses, rounds } = swissThresholds(teamIds.length);

  // confrontos da rodada atual = partidas agendadas (sorteadas e ainda sem placar)
  const pending = matches.filter((m) => m.scheduled && m.homeTeamId && m.awayTeamId);
  const inDispute = records.filter((r) => r.status === "Em disputa");
  const canDraw = pending.length === 0 && inDispute.length >= 2;
  const roundNo = matches.filter((m) => !m.scheduled && !m.isLive).length === 0 ? 1 : null;

  function setScore(id: string, side: "h" | "a", value: string) {
    setScores((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { h: "", a: "" }), [side]: value } }));
  }

  function drawRound() {
    // embaralha os times em disputa e emparelha por recorde (sem revanche)
    const pairs = generateSwissPairs(shuffle(inDispute), playedPairs(matches))
      .filter((p) => p.away !== BYE)
      .map((p) => ({ home: p.home, away: p.away }));
    if (pairs.length) onScheduleRound(pairs);
  }

  function savePending(m: Match) {
    const s = scores[m.id ?? ""] ?? { h: "", a: "" };
    const hs = Number(s.h);
    const as = Number(s.a);
    if (s.h === "" || s.a === "" || Number.isNaN(hs) || Number.isNaN(as)) return;
    onSaveResult(m.homeTeamId as string, m.awayTeamId as string, hs, as, m.id);
    setScores((prev) => {
      const next = { ...prev };
      delete next[m.id ?? ""];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* passo a passo */}
      <div className="rounded-lg bg-base/60 p-3 text-[11px] text-faint">
        <b className="text-white">Como usar:</b> 1) clique em <b className="text-gold">Sortear rodada</b>{" "}
        para gerar os confrontos · 2) preencha o <b className="text-white">placar</b> de cada jogo ·
        3) ao terminar, sorteie a próxima rodada. ({rounds} rodadas · {qualifyWins}V classifica ·{" "}
        {eliminateLosses}D elimina)
      </div>

      {/* CLASSIFICAÇÃO */}
      <div className="overflow-hidden rounded-lg bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-wide text-faint">
            <tr>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-2 py-2 font-semibold">Time</th>
              <th className="px-2 py-2 text-center font-semibold">V</th>
              <th className="px-2 py-2 text-center font-semibold">D</th>
              <th className="px-2 py-2 text-center font-semibold">SG</th>
              <th className="px-3 py-2 text-right font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={r.teamId} className={`border-b border-white/5 last:border-0 ${i % 2 ? "bg-base/40" : ""}`}>
                <td className="px-3 py-1.5 font-mono text-faint">{i + 1}</td>
                <td className="px-2 py-1.5 font-semibold">{name(r.teamId)}</td>
                <td className="px-2 py-1.5 text-center font-bold text-win">{r.wins}</td>
                <td className="px-2 py-1.5 text-center font-bold text-loss">{r.losses}</td>
                <td className="px-2 py-1.5 text-center text-faint">
                  {r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-bold"
                    style={{ backgroundColor: `${statusColor(r.status)}22`, color: statusColor(r.status) }}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RODADA ATUAL / SORTEIO */}
      {pending.length > 0 ? (
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">
            Rodada atual — insira os placares ({pending.length} jogos)
          </h4>
          <div className="flex flex-col gap-2">
            {pending.map((m) => {
              const s = scores[m.id ?? ""] ?? { h: "", a: "" };
              return (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-panel px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate text-right font-semibold">
                    {name(m.homeTeamId as string)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={s.h}
                    onChange={(e) => setScore(m.id ?? "", "h", e.target.value)}
                    className="w-12 rounded-md bg-base p-1.5 text-center text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                  <span className="text-faint">×</span>
                  <input
                    type="number"
                    min={0}
                    value={s.a}
                    onChange={(e) => setScore(m.id ?? "", "a", e.target.value)}
                    className="w-12 rounded-md bg-base p-1.5 text-center text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold">
                    {name(m.awayTeamId as string)}
                  </span>
                  <button
                    onClick={() => savePending(m)}
                    disabled={busy || s.h === "" || s.a === ""}
                    className="rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-40"
                  >
                    Salvar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : canDraw ? (
        <button
          onClick={drawRound}
          disabled={busy}
          className="self-start rounded-md bg-gold px-4 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
        >
          🎲 Sortear {roundNo === 1 ? "rodada 1" : "próxima rodada"}
        </button>
      ) : (
        <p className="rounded-md bg-base/60 p-3 text-xs text-faint">
          Sem confrontos pendentes — todos os times já estão classificados ou eliminados.
        </p>
      )}
    </div>
  );
}
