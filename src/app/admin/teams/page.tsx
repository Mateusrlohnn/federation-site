"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/ui/Icon";
import ImageUpload from "@/components/ui/ImageUpload";
import { focusStyle } from "@/lib/imageFocus";
import {
  TEAM_FIELDS,
  POSITIONS,
  emptyTeam,
  teamFromRow,
  teamToRow,
  type Team,
  type Position,
} from "@/lib/teams";

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
      supabase
        .from("teams")
        .select("*, team_players(player_id, position, active)")
        .order("titles", { ascending: false }),
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

  function addPlayer(id: string) {
    if (!draft || draft.roster.some((m) => m.playerId === id)) return;
    setDraft({ ...draft, roster: [...draft.roster, { playerId: id, position: null, active: true }] });
  }

  function removePlayer(id: string) {
    if (!draft) return;
    setDraft({ ...draft, roster: draft.roster.filter((m) => m.playerId !== id) });
  }

  function setPosition(id: string, position: Position | null) {
    if (!draft) return;
    setDraft({
      ...draft,
      roster: draft.roster.map((m) => (m.playerId === id ? { ...m, position } : m)),
    });
  }

  function setActive(id: string, active: boolean) {
    if (!draft) return;
    setDraft({
      ...draft,
      roster: draft.roster.map((m) => (m.playerId === id ? { ...m, active } : m)),
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

    // sincroniza o elenco (apaga e regrava) — mantém posição e status ativo/ex
    await supabase.from("team_players").delete().eq("team_id", teamId);
    if (draft.roster.length) {
      const { error } = await supabase.from("team_players").insert(
        draft.roster.map((m) => ({
          team_id: teamId,
          player_id: m.playerId,
          position: m.position,
          active: m.active,
        })),
      );
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
                      <img src={t.logoUrl} alt="" className="h-full w-full object-cover" style={focusStyle(t.logoUrl)} />
                    ) : (
                      <Icon name="shield" className="text-[10px] text-faint" />
                    )}
                  </span>
                  <span className="flex-1 truncate">
                    {t.name}
                    {!t.active && (
                      <span className="ml-1.5 rounded bg-faint/20 px-1 py-0.5 text-[9px] font-bold text-faint">
                        OFF
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-faint">
                    {t.roster.filter((m) => m.active).length} jog.
                  </span>
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

              {/* ON / OFF — aparece ou não na aba Times */}
              <div className="flex items-center justify-between rounded-md bg-panel px-3 py-2.5">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">
                    {draft.active ? "ON — visível na aba Times" : "OFF — time histórico"}
                  </span>
                  <span className="text-[11px] text-faint">
                    {draft.active
                      ? "Aparece normalmente na aba Times."
                      : "Não aparece em Times, mas pode ser usado em campeonatos antigos (Torneios)."}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, active: !draft.active })}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    draft.active ? "bg-win" : "bg-faint/40"
                  }`}
                  title="Alternar ON/OFF"
                  aria-pressed={draft.active}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
                      draft.active ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

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
                  <span className="text-sm font-bold">
                    Elenco ({draft.roster.filter((m) => m.active).length} ativos
                    {draft.roster.some((m) => !m.active) &&
                      `, ${draft.roster.filter((m) => !m.active).length} ex`}
                    )
                  </span>
                </div>

                {/* Lista de membros: posição + status Ativo/Ex + remover */}
                {draft.roster.length > 0 && (
                  <ul className="mb-3 flex flex-col gap-1.5">
                    {draft.roster.map((m) => (
                      <li
                        key={m.playerId}
                        className="flex flex-wrap items-center gap-2 rounded-md bg-panel px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {nameById.get(m.playerId) ?? m.playerId}
                        </span>

                        {/* Posição */}
                        <select
                          value={m.position ?? ""}
                          onChange={(e) =>
                            setPosition(m.playerId, (e.target.value || null) as Position | null)
                          }
                          className="rounded bg-base p-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                        >
                          <option value="">Sem posição</option>
                          {POSITIONS.map((pos) => (
                            <option key={pos.key} value={pos.key}>
                              {pos.label} ({pos.sigla})
                            </option>
                          ))}
                        </select>

                        {/* Status Ativo/Ex */}
                        <button
                          type="button"
                          onClick={() => setActive(m.playerId, !m.active)}
                          className={`rounded px-2 py-1 text-[11px] font-bold ${
                            m.active
                              ? "bg-win/20 text-win"
                              : "bg-faint/20 text-faint"
                          }`}
                          title="Alternar entre Ativo e Ex-jogador"
                        >
                          {m.active ? "Ativo" : "Ex"}
                        </button>

                        {/* Remover */}
                        <button
                          type="button"
                          onClick={() => removePlayer(m.playerId)}
                          className="rounded px-1.5 py-1 text-xs text-loss hover:bg-loss/10"
                          title="Remover do elenco (apaga o histórico deste jogador)"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
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
                    const sel = draft.roster.some((m) => m.playerId === p.id);
                    return (
                      <li key={p.id}>
                        <button
                          onClick={() => (sel ? removePlayer(p.id) : addPlayer(p.id))}
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
