"use client";

import { useEffect, useMemo, useState } from "react";
import { ACCENT } from "@/components/ui/stats";
import { avatarUrl, type HofPlayer } from "@/lib/hof";

/**
 * Comparação de Jogadores — ferramenta puramente apresentacional.
 *
 * Recebe a lista de jogadores já existente (mesma usada pela PlayersView),
 * permite escolher dois e os compara lado a lado. Não busca dados novos, não
 * altera nenhuma rota/API e não toca no estado de negócio do app — apenas lê
 * os campos reais de HofPlayer e calcula o confronto/equivalência em memória.
 */

// Ouro/Laranja de destaque do veredito e do painel de equivalência (spec).
const GOLD = "#ff9100";

/** Critérios de confronto, em ordem de importância (desempate lexicográfico). */
const LEADER_CRITERIA: { label: string; get: (p: HofPlayer) => number }[] = [
  { label: "Títulos", get: (p) => p.titles },
  { label: "MVPs", get: (p) => p.mvp },
  { label: "Vices", get: (p) => p.runnerUps },
  { label: "Pódios (Top 1–3)", get: (p) => p.top1 + p.top2 + p.top3 },
  { label: "Pontuação total", get: (p) => p.points },
];

/** Métricas exibidas lado a lado (maior vence = verde, menor = vermelho). */
const METRICS: { label: string; get: (p: HofPlayer) => number }[] = [
  { label: "Títulos", get: (p) => p.titles },
  { label: "MVP", get: (p) => p.mvp },
  { label: "Vices", get: (p) => p.runnerUps },
  { label: "Top 1", get: (p) => p.top1 },
  { label: "Top 2", get: (p) => p.top2 },
  { label: "Top 3", get: (p) => p.top3 },
  { label: "Pontos", get: (p) => p.points },
];

type Winner = "a" | "b" | "tie";

/** Decide o líder pela ordem de importância dos critérios. */
function decideLeader(a: HofPlayer, b: HofPlayer): { winner: Winner; reason: string } {
  for (const c of LEADER_CRITERIA) {
    const av = c.get(a);
    const bv = c.get(b);
    if (av !== bv) return { winner: av > bv ? "a" : "b", reason: c.label };
  }
  return { winner: "tie", reason: "" };
}

/** Seletor com busca: digite para filtrar e clique para escolher um jogador. */
function PlayerPicker({
  label,
  value,
  exclude,
  options,
  onChange,
}: {
  label: string;
  value: string;
  exclude: string;
  options: { p: HofPlayer; rank: number }[];
  onChange: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = options.filter(({ p }) =>
    p.name.toLowerCase().includes(q.toLowerCase().trim()),
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-faint">{label}</span>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Pesquisar jogador…"
        className="w-full rounded-md bg-panel p-2.5 text-sm text-white placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-gold/60"
      />
      <div className="max-h-36 overflow-y-auto rounded-md bg-panel/40">
        {filtered.length === 0 ? (
          <div className="p-3 text-center text-xs text-faint">Nenhum jogador encontrado.</div>
        ) : (
          filtered.map(({ p, rank }) => {
            const isSelected = p.name === value;
            const isExcluded = p.name === exclude;
            return (
              <button
                key={p.name}
                type="button"
                disabled={isExcluded}
                onClick={() => onChange(p.name)}
                className={`flex w-full items-center gap-2.5 border-b border-white/5 px-3 py-2 text-left transition-colors last:border-0 disabled:opacity-30 ${
                  isSelected ? "bg-gold/20" : "hover:bg-panel"
                }`}
                style={isSelected ? { boxShadow: `inset 2px 0 0 0 ${GOLD}` } : undefined}
              >
                <span className="flex h-9 w-7 shrink-0 items-end justify-center overflow-hidden rounded bg-panel">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl(p.nick || p.name)}
                    alt={p.name}
                    className="h-[42px] w-7 object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="shrink-0 text-xs font-bold text-faint">#{rank}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Cabeçalho de um jogador (avatar grande + nome + selo de Líder). */
function PlayerHead({
  player,
  rank,
  isLeader,
}: {
  player: HofPlayer;
  rank: number;
  isLeader: boolean;
}) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center rounded-lg bg-panel p-4 text-center transition-colors"
      style={isLeader ? { boxShadow: `0 0 0 2px ${GOLD}` } : undefined}
    >
      {isLeader && (
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#1a1a1e]"
          style={{ backgroundColor: GOLD }}
        >
          ★ Líder
        </span>
      )}
      <div className="flex h-44 w-40 items-end justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarUrl(player.nick || player.name)}
          alt={player.name}
          className="h-[200px] w-40 object-contain"
        />
      </div>
      <span className="mt-2 max-w-full truncate text-2xl font-extrabold sm:text-3xl">
        {player.name}
      </span>
      <span className="text-base font-semibold text-faint">Ranking #{rank}</span>
      <span className="mt-1 text-3xl font-extrabold text-gold">{player.points} pts</span>
    </div>
  );
}

/** Bloco numérico de uma métrica, colorido conforme vitória/derrota/empate. */
function MetricCell({ value, state }: { value: number; state: "win" | "loss" | "tie" }) {
  const bg = state === "win" ? ACCENT.win : state === "loss" ? ACCENT.loss : "#222226";
  const text = state === "win" ? "#1a1a1e" : "#ffffff";
  return (
    <span
      className="inline-flex h-9 min-w-12 items-center justify-center rounded-md px-2 text-base font-bold tabular-nums"
      style={{ backgroundColor: bg, color: text }}
    >
      {value}
    </span>
  );
}

/** Painel de equivalência: o que falta ao jogador atrás para alcançar o líder. */
function EquivalencePanel({ leader, behind }: { leader: HofPlayer; behind: HofPlayer }) {
  const goals = [
    { label: "Títulos", need: Math.max(0, leader.titles - behind.titles) },
    { label: "Top 1", need: Math.max(0, leader.top1 - behind.top1) },
    { label: "MVPs", need: Math.max(0, leader.mvp - behind.mvp) },
  ];

  const pending = goals.filter((g) => g.need > 0);
  const sentence =
    pending.length === 0
      ? `${behind.name} já iguala ou supera ${leader.name} em Títulos, Top 1 e MVPs.`
      : `Para se equivaler a ${leader.name}, faltam para ${behind.name}: ` +
        pending.map((g) => `+${g.need} ${g.label}`).join(", ").replace(/, ([^,]*)$/, " e $1") +
        ".";

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: "rgba(255,145,0,0.10)", boxShadow: `inset 0 0 0 1px ${GOLD}` }}
    >
      <h3
        className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide"
        style={{ color: GOLD }}
      >
        🎯 Metas de equivalência
      </h3>
      <p className="text-sm leading-relaxed text-white">{sentence}</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {goals.map((g) => (
          <div key={g.label} className="rounded-md bg-panel px-2 py-2.5 text-center">
            <div
              className="text-2xl font-extrabold"
              style={{ color: g.need > 0 ? GOLD : ACCENT.win }}
            >
              {g.need > 0 ? `+${g.need}` : "0"}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-faint">{g.label}</div>
            {g.need === 0 && (
              <div className="text-[10px] font-bold uppercase" style={{ color: ACCENT.win }}>
                Meta atingida
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PlayerComparisonModal({
  players,
  onClose,
}: {
  players: HofPlayer[];
  onClose: () => void;
}) {
  // Ranking por pontuação (mesma regra da tabela principal).
  const ranked = useMemo(
    () =>
      [...players]
        .sort((a, b) => b.points - a.points)
        .map((p, i) => ({ p, rank: i + 1 })),
    [players],
  );
  const byName = useMemo(() => new Map(ranked.map((r) => [r.p.name, r])), [ranked]);

  // Seleção atual (vazia por padrão) e o confronto efetivamente "realizado".
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [committed, setCommitted] = useState<{ a: string; b: string } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canCompare = nameA !== "" && nameB !== "" && nameA !== nameB;

  const a = committed ? byName.get(committed.a) : undefined;
  const b = committed ? byName.get(committed.b) : undefined;
  const ready = !!(a && b);

  const verdict = ready ? decideLeader(a.p, b.p) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comparação de jogadores"
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

        {!ready && (
          <>
            <h2 className="pr-10 text-xl font-bold tracking-tight sm:text-2xl">
              Comparação de Jogadores
            </h2>
            <p className="mt-1 text-sm text-faint">
              Pesquise e selecione dois jogadores, depois clique em “Realizar Comparação”.
            </p>

            {/* Seleção lado a lado com busca */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
              <PlayerPicker
                label="Jogador A"
                value={nameA}
                exclude={nameB}
                options={ranked}
                onChange={setNameA}
              />
              <span className="hidden shrink-0 pt-8 text-sm font-extrabold text-faint sm:block">
                VS
              </span>
              <PlayerPicker
                label="Jogador B"
                value={nameB}
                exclude={nameA}
                options={ranked}
                onChange={setNameB}
              />
            </div>

            {/* Botão de ação */}
            <button
              type="button"
              disabled={!canCompare}
              onClick={() => setCommitted({ a: nameA, b: nameB })}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-gold px-4 py-3 text-sm font-bold text-[#1a1a1e] transition-transform hover:scale-[1.01] active:scale-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            >
              Realizar Comparação
            </button>
          </>
        )}

        {ready && (
          <div className="animate-content-in flex flex-col gap-4">
            {/* Cabeçalho do resultado + voltar para nova seleção */}
            <div className="flex items-center justify-between gap-3 pr-10">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                Comparação de Jogadores
              </h2>
              <button
                type="button"
                onClick={() => setCommitted(null)}
                className="shrink-0 rounded-md bg-panel px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-panel/70"
              >
                ← Nova comparação
              </button>
            </div>

            {/* Veredito (largura total) */}
            <div
              className="rounded-lg p-3 text-center"
              style={{ backgroundColor: GOLD, color: "#1a1a1e" }}
            >
              {verdict!.winner === "tie" ? (
                <span className="text-base font-extrabold">Empate técnico</span>
              ) : (
                <span className="text-base font-extrabold">
                  🏆 {(verdict!.winner === "a" ? a.p : b.p).name} é o melhor
                </span>
              )}
            </div>

            {/* Layout horizontal: jogadores nas laterais, métricas ao centro */}
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
              <PlayerHead player={a.p} rank={a.rank} isLeader={verdict!.winner === "a"} />

              {/* Confronto de métricas (coluna central) */}
              <div className="order-last rounded-lg bg-panel/40 p-2 lg:order-none">
                {METRICS.map((m) => {
                  const av = m.get(a.p);
                  const bv = m.get(b.p);
                  const aState = av === bv ? "tie" : av > bv ? "win" : "loss";
                  const bState = av === bv ? "tie" : bv > av ? "win" : "loss";
                  return (
                    <div
                      key={m.label}
                      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/5 py-2 last:border-0"
                    >
                      <div className="flex justify-end">
                        <MetricCell value={av} state={aState} />
                      </div>
                      <span className="min-w-16 text-center text-xs font-bold uppercase tracking-wide text-faint">
                        {m.label}
                      </span>
                      <div className="flex justify-start">
                        <MetricCell value={bv} state={bState} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <PlayerHead player={b.p} rank={b.rank} isLeader={verdict!.winner === "b"} />
            </div>

            {/* Painel de equivalência para quem ficou atrás (largura total) */}
            {verdict!.winner !== "tie" && (
              <EquivalencePanel
                leader={verdict!.winner === "a" ? a.p : b.p}
                behind={verdict!.winner === "a" ? b.p : a.p}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
