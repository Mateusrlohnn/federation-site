"use client";

import { useEffect } from "react";
import Icon from "@/components/ui/Icon";
import { ACCENT, ProportionBar } from "@/components/ui/stats";
import { avatarUrl } from "@/lib/hof";
import { POSITIONS, type Position } from "@/lib/teams";

/**
 * Detalhe de um time — modal somente de apresentação.
 * Monta-se inteiramente a partir dos dados já carregados pela página de Times
 * (elenco com posição/status e torneios com campeão). Não busca dados novos
 * nem altera qualquer rota/API.
 */

export type RosterEntry = { name: string; position: Position | null; active: boolean };
export type CupEntry = {
  id: string;
  name: string;
  status: string;
  image: string;
  championTeamId: string | null;
  teamIds: string[];
};
export type TeamDetail = {
  id: string;
  name: string;
  logo: string;
  titles: number;
  runnerUps: number;
  wins: number;
  losses: number;
  roster: RosterEntry[];
};

const statusStyle: Record<string, string> = {
  "Em andamento": "bg-gold text-[#1a1a1e]",
  Finalizado: "bg-win text-[#0a1f10]",
  "Em breve": "bg-draw text-white",
};

// Ordem de exibição das posições (siglas), com "sem posição" por último.
const GROUP_ORDER: (Position | "none")[] = ["GK", "ZAG", "MID", "ATK", "none"];

function siglaOf(g: Position | "none") {
  return g === "none" ? "—" : POSITIONS.find((p) => p.key === g)!.sigla;
}
function labelOf(g: Position | "none") {
  return g === "none" ? "Sem posição" : POSITIONS.find((p) => p.key === g)!.label;
}

/** Agrupa jogadores por posição, preservando a ordem GK→ZAG→MID→ATK. */
function groupByPosition(members: RosterEntry[]) {
  return GROUP_ORDER.map((g) => ({
    key: g,
    sigla: siglaOf(g),
    label: labelOf(g),
    players: members.filter((m) => (m.position ?? "none") === g),
  })).filter((grp) => grp.players.length > 0);
}

function PlayerChip({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md bg-panel py-0.5 pl-0.5 pr-2">
      <span className="flex h-7 w-6 shrink-0 items-end justify-center overflow-hidden rounded bg-base">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl(name)} alt={name} className="h-[34px] w-6 object-contain" />
      </span>
      <span className="text-sm font-medium">{name}</span>
    </span>
  );
}

function PositionGroups({ members }: { members: RosterEntry[] }) {
  const groups = groupByPosition(members);
  return (
    <div className="flex flex-col gap-2.5">
      {groups.map((grp) => (
        <div key={grp.key} className="flex items-start gap-2.5">
          <span
            className="mt-0.5 inline-flex min-w-12 shrink-0 items-center justify-center rounded-md bg-gold px-2 py-1 text-xs font-extrabold text-[#1a1a1e]"
            title={grp.label}
          >
            {grp.sigla}
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {grp.players.map((p) => (
              <PlayerChip key={p.name} name={p.name} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TeamDetailModal({
  team,
  cups,
  onClose,
}: {
  team: TeamDetail | null;
  cups: CupEntry[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!team) return null;

  const active = team.roster.filter((m) => m.active);
  const former = team.roster.filter((m) => !m.active);

  // Copas que o time disputou e, entre elas, as que venceu.
  const played = cups.filter((c) => c.teamIds.includes(team.id));
  const titlesWon = played.filter((c) => c.championTeamId === team.id);

  const statCards = [
    { label: "Títulos", value: team.titles, color: ACCENT.gold },
    { label: "Vices", value: team.runnerUps, color: ACCENT.draw },
    { label: "Vitórias", value: team.wins, color: ACCENT.win },
    { label: "Derrotas", value: team.losses, color: ACCENT.loss },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhe do time ${team.name}`}
      onClick={onClose}
      className="animate-overlay-in fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-card p-6"
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-md bg-panel text-lg text-faint hover:text-white"
        >
          ✕
        </button>

        {/* Cabeçalho */}
        <div className="flex items-center gap-4 pr-10">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-panel">
            {team.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo} alt={team.name} className="h-full w-full object-cover" />
            ) : (
              <Icon name="shield" className="text-2xl text-faint" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{team.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {titlesWon.length > 0 && (
                <span className="rounded-md bg-gold px-2.5 py-1 text-sm font-bold text-[#1a1a1e]">
                  {titlesWon.length}× <Icon name="trophy" />
                </span>
              )}
              <span className="rounded-md bg-panel px-2.5 py-1 text-sm font-semibold text-faint">
                {played.length} {played.length === 1 ? "copa disputada" : "copas disputadas"}
              </span>
            </div>
          </div>
        </div>

        {/* Estatísticas + proporção V/D */}
        <div className="mt-5 grid grid-cols-4 gap-2">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-md bg-panel py-3 text-center">
              <div className="text-2xl font-extrabold" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="mt-0.5 text-xs text-faint">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <ProportionBar
            segments={[
              { value: team.wins, color: ACCENT.win, title: "Vitórias" },
              { value: team.losses, color: ACCENT.loss, title: "Derrotas" },
            ]}
          />
          <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide">
            <span className="text-win">Vitórias</span>
            <span className="text-loss">Derrotas</span>
          </div>
        </div>

        {/* Histórico de copas */}
        <section className="mt-6">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-faint">
            <Icon name="trophy" className="text-gold" />
            Histórico de copas · {titlesWon.length}{" "}
            {titlesWon.length === 1 ? "título" : "títulos"}
          </h3>
          {played.length === 0 ? (
            <p className="rounded-md bg-panel p-3 text-sm text-faint">
              Este time ainda não disputou torneios registrados.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {played.map((c) => {
                const champ = c.championTeamId === team.id;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-md bg-panel px-3 py-2"
                    style={champ ? { boxShadow: `inset 0 0 0 1px ${ACCENT.gold}` } : undefined}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-base">
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon name="trophy" className="text-faint" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                    {champ && (
                      <span className="shrink-0 rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-[#1a1a1e]">
                        🏆 Campeão
                      </span>
                    )}
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        statusStyle[c.status] ?? "bg-base text-faint"
                      }`}
                    >
                      {c.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Elenco atual por posição */}
        <section className="mt-6">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-faint">
            <Icon name="user" className="text-win" />
            Elenco atual ({active.length}) · por posição
          </h3>
          {active.length === 0 ? (
            <p className="rounded-md bg-panel p-3 text-sm text-faint">Sem jogadores ativos.</p>
          ) : (
            <PositionGroups members={active} />
          )}
        </section>

        {/* Ex-jogadores por posição */}
        {former.length > 0 && (
          <section className="mt-6">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-faint">
              <Icon name="handshake-angle" className="text-faint" />
              Já passaram pelo time ({former.length}) · por posição
            </h3>
            <PositionGroups members={former} />
          </section>
        )}
      </div>
    </div>
  );
}
