"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/ui/Icon";
import ImageUpload from "@/components/ui/ImageUpload";
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
          className={`mb-4 rounded-md p-3 text-xs ${
            err ? "bg-loss/10 text-loss" : "bg-win/10 text-win"
          }`}
        >
          {err || msg}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        {/* LISTA DE TIMES */}
        <div className="flex h-max flex-col gap-3 rounded-lg bg-card p-3">
          <button
            onClick={() => {
              setDraft(emptyTeam());
              setErr("");
              setMsg("");
            }}
            className="rounded-md bg-gold py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90"
          >
            + Novo time
          </button>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar time..."
            className="rounded-md bg-panel p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
          />
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto text-sm">
            {filteredTeams.map((t) => (
              <li key={t.id ?? t.name}>
                <button
                  onClick={() => {
                    setDraft({ ...t });
                    setErr("");
                    setMsg("");
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel ${
                    draft?.id && draft.id === t.id ? "bg-panel ring-1 ring-gold" : ""
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-base">
                    {t.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon name="shield" className="text-[10px] text-faint" />
                    )}
                  </span>
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="text-xs text-faint">{t.playerIds.length} jog.</span>
                </button>
              </li>
            ))}
            {filteredTeams.length === 0 && (
              <li className="px-2 py-1 text-xs text-faint">Nenhum time ainda.</li>
            )}
          </ul>
        </div>

        {/* EDITOR */}
        <div className="rounded-lg bg-card p-4">
          {!draft ? (
            <p className="text-sm text-faint">
              Selecione um time, ou clique em <b>+ Novo time</b>.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <ImageUpload
                label="Foto do time"
                folder="teams"
                value={draft.logoUrl}
                onChange={(url) => setDraft({ ...draft, logoUrl: url })}
              />

              <label className="flex flex-col gap-1 text-xs">
                Nome do time
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                />
              </label>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TEAM_FIELDS.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1 text-xs">
                    {f.label}
                    <input
                      type="number"
                      min={0}
                      value={draft[f.key]}
                      onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) || 0 })}
                      className="rounded-md bg-panel p-2 text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                    />
                  </label>
                ))}
              </div>

              {/* ELENCO */}
              <div className="border-t border-white/5 pt-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold">Elenco ({draft.playerIds.length})</span>
                </div>
                {draft.playerIds.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {draft.playerIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => togglePlayer(id)}
                        className="flex items-center gap-1 rounded-md bg-gold px-2 py-0.5 text-xs font-medium text-[#1a1a1e]"
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
                  className="mb-2 w-full rounded-md bg-panel p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                />
                <ul className="flex max-h-[200px] flex-col gap-0.5 overflow-y-auto rounded-md bg-panel p-1 text-sm">
                  {filteredPlayers.slice(0, 60).map((p) => {
                    const sel = draft.playerIds.includes(p.id);
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => togglePlayer(p.id)}
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-base ${
                            sel ? "text-gold" : ""
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

              <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-3">
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
          )}
        </div>
      </div>
    </>
  );
}
