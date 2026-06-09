"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAT_FIELDS, computePoints, emptyPlayer, fromRow, toRow, avatarUrl, type HofPlayer } from "@/lib/hof";
import { POSITIONS, type Position } from "@/lib/teams";

type TeamOption = { id: string; name: string };

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<HofPlayer[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  // player_id -> id do time ativo onde ele joga hoje (para pré-selecionar o card atual)
  const [currentTeam, setCurrentTeam] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<HofPlayer | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("points", { ascending: false });
    if (!error && data) setPlayers(data.map(fromRow));
  }, [supabase]);

  const loadTeams = useCallback(async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, active, team_players(player_id, active)")
      .order("name", { ascending: true });
    if (error || !data) return;
    setTeams(data.map((t) => ({ id: t.id as string, name: String(t.name) })));
    // time atual = time ativo cujo elenco contém o jogador com active=true
    const map: Record<string, string> = {};
    for (const t of data as {
      id: string;
      active: boolean;
      team_players: { player_id: string; active: boolean }[] | null;
    }[]) {
      if (t.active === false) continue;
      for (const rp of t.team_players ?? []) {
        if (rp.active !== false && !map[rp.player_id]) map[rp.player_id] = t.id;
      }
    }
    setCurrentTeam(map);
  }, [supabase]);

  useEffect(() => {
    load();
    loadTeams();
  }, [load, loadTeams]);

  // Ao selecionar um jogador para editar: pré-seleciona o time atual quando vazio.
  function edit(p: HofPlayer) {
    setDraft({
      ...p,
      cardAtualTeamId: p.cardAtualTeamId ?? (p.id ? currentTeam[p.id] ?? null : null),
    });
    setErr("");
    setMsg("");
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setErr("Informe o nome do jogador.");
    setBusy(true);
    setErr("");
    setMsg("");
    const row = toRow(draft);
    const res = draft.id
      ? await supabase.from("players").update(row).eq("id", draft.id)
      : await supabase.from("players").insert(row);
    setBusy(false);
    if (res.error) return setErr(res.error.message);
    setMsg(`Jogador "${draft.name}" salvo.`);
    setDraft(null);
    await load();
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirm(`Remover "${draft.name}"?`)) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const { error } = await supabase.from("players").delete().eq("id", draft.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg(`Jogador "${draft.name}" removido.`);
    setDraft(null);
    await load();
  }

  const filtered = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase().trim()));
  const livePoints = draft ? computePoints(draft) : 0;

  return (
    <>
      {(msg || err) && (
        <div
          className={`mb-4 rounded-md p-3 text-xs ${
            err ? "bg-loss/10 text-loss" : "bg-win/10 text-win"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <div className="flex h-max flex-col gap-3 rounded-lg bg-card p-3">
          <button
            onClick={() => {
              setDraft(emptyPlayer());
              setErr("");
              setMsg("");
            }}
            className="rounded-md bg-gold py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90"
          >
            + Novo jogador
          </button>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar..."
            className="rounded-md bg-panel p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto text-sm">
            {filtered.map((p) => (
              <li key={p.id ?? p.name}>
                <button
                  onClick={() => edit(p)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-panel ${
                    draft?.id && draft.id === p.id ? "bg-panel ring-1 ring-gold" : ""
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="font-mono text-xs text-gold">{p.points}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg bg-card p-4">
          {!draft ? (
            <p className="text-sm text-faint">
              Selecione um jogador, ou clique em <b>+ Novo jogador</b>.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {(draft.nick.trim() || draft.name.trim()) && (
                  <span className="flex h-[60px] w-[40px] shrink-0 items-end justify-center overflow-hidden rounded-md bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl(draft.nick.trim() || draft.name.trim())}
                      alt={draft.name}
                      className="h-[60px] w-[40px] object-contain"
                    />
                  </span>
                )}
                <div className="flex flex-1 flex-col gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    Nome do jogador (exibição)
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Nick (Hubbe) — puxa o avatar
                    <input
                      type="text"
                      value={draft.nick}
                      placeholder={draft.name || "ex.: Mathz"}
                      onChange={(e) => setDraft({ ...draft, nick: e.target.value })}
                      className="rounded-md bg-panel p-2 text-sm text-white placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-gold/50"
                    />
                  </label>
                </div>
                <label className="flex w-40 flex-col gap-1 text-xs">
                  Posição natural
                  <select
                    value={draft.position ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, position: (e.target.value || null) as Position | null })
                    }
                    className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                  >
                    <option value="">Sem posição</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos.key} value={pos.key}>
                        {pos.label} ({pos.sigla})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {STAT_FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-xs">
                    <span className="flex items-center justify-between">
                      {f.label}
                      <span className="text-faint">×{f.weight}</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draft[f.key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [f.key]: Number(e.target.value) || 0 })
                      }
                      className="rounded-md bg-panel p-2 text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                    />
                  </label>
                ))}
              </div>

              {/* Cards estilo FIFA — atributos manuais */}
              <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
                <span className="text-xs font-bold uppercase tracking-wide text-faint">
                  Cards (FIFA Ultimate Team)
                </span>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs">
                    Overall do Auge
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={draft.cardAugeOverall ?? ""}
                      placeholder="ex.: 88"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          cardAugeOverall: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="rounded-md bg-panel p-2 text-white placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-gold/50"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Overall Atual
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={draft.cardAtualOverall ?? ""}
                      placeholder="ex.: 87"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          cardAtualOverall: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="rounded-md bg-panel p-2 text-white placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-gold/50"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-xs">
                    <input
                      type="checkbox"
                      checked={draft.aposentado}
                      onChange={(e) => setDraft({ ...draft, aposentado: e.target.checked })}
                      className="h-4 w-4 accent-gold"
                    />
                    Aposentado <span className="text-faint">(card branco "Icon")</span>
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-3 rounded-md bg-panel/40 p-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-faint">
                      Card do Auge
                    </span>
                    <label className="flex flex-col gap-1 text-xs">
                      Time
                      <select
                        value={draft.cardAugeTeamId ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, cardAugeTeamId: e.target.value || null })
                        }
                        className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                      >
                        <option value="">Sem time</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      Posição no card{" "}
                      {draft.cardAugePosition == null && draft.position && (
                        <span className="text-faint">(usa a natural)</span>
                      )}
                      <select
                        value={draft.cardAugePosition ?? draft.position ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            cardAugePosition: (e.target.value || null) as Position | null,
                          })
                        }
                        className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                      >
                        <option value="">Sem posição</option>
                        {POSITIONS.map((pos) => (
                          <option key={pos.key} value={pos.key}>
                            {pos.label} ({pos.sigla})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-col gap-3 rounded-md bg-panel/40 p-3">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-faint">
                      Card Atual
                    </span>
                    <label className="flex flex-col gap-1 text-xs">
                      Time{" "}
                      {draft.id && currentTeam[draft.id] && (
                        <span className="text-faint">(auto: time atual do jogador)</span>
                      )}
                      <select
                        value={draft.cardAtualTeamId ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, cardAtualTeamId: e.target.value || null })
                        }
                        className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                      >
                        <option value="">Sem time</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs">
                      Posição no card{" "}
                      {draft.cardAtualPosition == null && draft.position && (
                        <span className="text-faint">(usa a natural)</span>
                      )}
                      <select
                        value={draft.cardAtualPosition ?? draft.position ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            cardAtualPosition: (e.target.value || null) as Position | null,
                          })
                        }
                        className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                      >
                        <option value="">Sem posição</option>
                        {POSITIONS.map((pos) => (
                          <option key={pos.key} value={pos.key}>
                            {pos.label} ({pos.sigla})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="text-sm">
                  Pontos: <span className="text-lg font-bold text-gold">{livePoints}</span>
                </div>
                <div className="flex gap-2">
                  {draft.id && (
                    <button
                      onClick={remove}
                      disabled={busy}
                      className="rounded-md border border-loss/40 px-4 py-2 text-sm text-loss hover:bg-loss/10 disabled:opacity-60"
                    >
                      Remover
                    </button>
                  )}
                  <button
                    onClick={save}
                    disabled={busy}
                    className="rounded-md bg-gold px-5 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Salvando…" : "Salvar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
