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
          className={`p-3 mb-4 rounded-lg text-xs ${
            err
              ? "bg-red-950 text-red-300 border border-red-800"
              : "bg-green-950 text-green-300 border border-green-800"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid md:grid-cols-[300px_1fr] gap-4">
        <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-3 flex flex-col gap-3 h-max">
          <button
            onClick={() => {
              setDraft(emptyPlayer());
              setErr("");
              setMsg("");
            }}
            className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg py-2 text-sm"
          >
            + Novo jogador
          </button>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar..."
            className="text-xs border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded"
          />
          <ul className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto text-sm">
            {filtered.map((p) => (
              <li key={p.id ?? p.name}>
                <button
                  onClick={() => {
                    setDraft({ ...p });
                    setErr("");
                    setMsg("");
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-[#1d1d1d] ${
                    draft?.id && draft.id === p.id ? "bg-[#1d1d1d] ring-1 ring-yellow-500" : ""
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-yellow-500 font-mono text-xs">{p.points}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4">
          {!draft ? (
            <p className="text-[#a9a9a9] text-sm">
              Selecione um jogador, ou clique em <b>+ Novo jogador</b>.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                {draft.name.trim() && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl(draft.name.trim())}
                    alt={draft.name}
                    className="h-[60px] w-[40px] object-contain"
                  />
                )}
                <label className="flex-1 flex flex-col gap-1 text-xs">
                  Nome do jogador (Hubbe)
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded text-sm"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {STAT_FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-xs">
                    <span className="flex items-center justify-between">
                      {f.label}
                      <span className="text-[#777]">×{f.weight}</span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={draft[f.key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [f.key]: Number(e.target.value) || 0 })
                      }
                      className="border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded"
                    />
                  </label>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-[#454545] pt-3">
                <div className="text-sm">
                  Pontos: <span className="text-yellow-500 font-bold text-lg">{livePoints}</span>
                </div>
                <div className="flex gap-2">
                  {draft.id && (
                    <button
                      onClick={remove}
                      disabled={busy}
                      className="border border-red-800 text-red-300 rounded-lg px-4 py-2 text-sm hover:bg-red-950 disabled:opacity-60"
                    >
                      Remover
                    </button>
                  )}
                  <button
                    onClick={save}
                    disabled={busy}
                    className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg px-5 py-2 text-sm disabled:opacity-60"
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
