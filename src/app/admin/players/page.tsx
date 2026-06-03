"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { STAT_FIELDS, computePoints, emptyPlayer, fromRow, toRow, avatarUrl, type HofPlayer } from "@/lib/hof";

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<HofPlayer[]>([]);
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

  useEffect(() => {
    load();
  }, [load]);

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
                  onClick={() => {
                    setDraft({ ...p });
                    setErr("");
                    setMsg("");
                  }}
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
                {draft.name.trim() && (
                  <span className="flex h-[60px] w-[40px] shrink-0 items-end justify-center overflow-hidden rounded-md bg-panel">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl(draft.name.trim())}
                      alt={draft.name}
                      className="h-[60px] w-[40px] object-contain"
                    />
                  </span>
                )}
                <label className="flex flex-1 flex-col gap-1 text-xs">
                  Nome do jogador (Hubbe)
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                  />
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
