"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TEAM_FIELDS, emptyTeam, teamFromRow, teamToRow, type Team } from "@/lib/teams";

type PlayerLite = { id: string; name: string };

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerLite[]>([]);
  const [draft, setDraft] = useState<Team | null>(null);
  const [q, setQ] = useState("");
  const [rosterQ, setRosterQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const supabase = createClient();

  const load = useCallback(async () => {
    const [t, p] = await Promise.all([
      supabase.from("teams").select("*, team_players(player_id)").order("titles", { ascending: false }),
      supabase.from("players").select("id, name").order("name"),
    ]);
    if (!t.error && t.data) setTeams(t.data.map(teamFromRow));
    if (!p.error && p.data) setAllPlayers(p.data as PlayerLite[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    allPlayers.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [allPlayers]);

  function togglePlayer(id: string) {
    if (!draft) return;
    const has = draft.playerIds.includes(id);
    setDraft({
      ...draft,
      playerIds: has ? draft.playerIds.filter((x) => x !== id) : [...draft.playerIds, id],
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setErr("Informe o nome do time.");
    setBusy(true);
    setErr("");
    setMsg("");

    let teamId = draft.id;
    if (teamId) {
      const { error } = await supabase.from("teams").update(teamToRow(draft)).eq("id", teamId);
      if (error) {
        setBusy(false);
        return setErr(error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("teams")
        .insert(teamToRow(draft))
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        return setErr(error?.message ?? "Erro ao criar time.");
      }
      teamId = data.id as string;
    }

    // sincroniza o elenco (apaga e regrava)
    await supabase.from("team_players").delete().eq("team_id", teamId);
    if (draft.playerIds.length) {
      const { error } = await supabase
        .from("team_players")
        .insert(draft.playerIds.map((pid) => ({ team_id: teamId, player_id: pid })));
      if (error) {
        setBusy(false);
        return setErr(error.message);
      }
    }

    setBusy(false);
    setMsg(`Time "${draft.name}" salvo.`);
    setDraft(null);
    await load();
  }

  async function remove() {
    if (!draft?.id) return;
    if (!confirm(`Remover o time "${draft.name}"?`)) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const { error } = await supabase.from("teams").delete().eq("id", draft.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg(`Time "${draft.name}" removido.`);
    setDraft(null);
    await load();
  }

  const filteredTeams = teams.filter((t) => t.name.toLowerCase().includes(q.toLowerCase().trim()));
  const filteredPlayers = allPlayers.filter((p) =>
    p.name.toLowerCase().includes(rosterQ.toLowerCase().trim()),
  );

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
        {/* LISTA DE TIMES */}
        <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-3 flex flex-col gap-3 h-max">
          <button
            onClick={() => {
              setDraft(emptyTeam());
              setErr("");
              setMsg("");
            }}
            className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg py-2 text-sm"
          >
            + Novo time
          </button>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar time..."
            className="text-xs border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded"
          />
          <ul className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto text-sm">
            {filteredTeams.map((t) => (
              <li key={t.id ?? t.name}>
                <button
                  onClick={() => {
                    setDraft({ ...t });
                    setErr("");
                    setMsg("");
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-[#1d1d1d] ${
                    draft?.id && draft.id === t.id ? "bg-[#1d1d1d] ring-1 ring-yellow-500" : ""
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="text-[#8d8d8d] text-xs">{t.playerIds.length} jog.</span>
                </button>
              </li>
            ))}
            {filteredTeams.length === 0 && (
              <li className="text-xs text-[#8d8d8d] px-2 py-1">Nenhum time ainda.</li>
            )}
          </ul>
        </div>

        {/* EDITOR */}
        <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4">
          {!draft ? (
            <p className="text-[#a9a9a9] text-sm">
              Selecione um time, ou clique em <b>+ Novo time</b>.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-xs">
                Nome do time
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded text-sm"
                />
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TEAM_FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-xs">
                    {f.label}
                    <input
                      type="number"
                      min={0}
                      value={draft[f.key]}
                      onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) || 0 })}
                      className="border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded"
                    />
                  </label>
                ))}
              </div>

              {/* ELENCO */}
              <div className="border-t border-[#454545] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">Elenco ({draft.playerIds.length})</span>
                </div>
                {draft.playerIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {draft.playerIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => togglePlayer(id)}
                        className="flex items-center gap-1 bg-yellow-500 text-yellow-900 rounded-full px-2 py-0.5 text-xs font-medium"
                        title="Remover do elenco"
                      >
                        {nameById.get(id) ?? id} ✕
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  value={rosterQ}
                  onChange={(e) => setRosterQ(e.target.value)}
                  placeholder="Buscar jogador para adicionar..."
                  className="text-xs border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded w-full mb-2"
                />
                <ul className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto text-sm border border-[#454545] rounded-lg p-1">
                  {filteredPlayers.slice(0, 60).map((p) => {
                    const sel = draft.playerIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => togglePlayer(p.id)}
                          className={`w-full text-left rounded px-2 py-1 hover:bg-[#1d1d1d] flex items-center justify-between ${
                            sel ? "text-yellow-500" : ""
                          }`}
                        >
                          {p.name}
                          <span>{sel ? "✓" : "+"}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#454545] pt-3">
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
          )}
        </div>
      </div>
    </>
  );
}
