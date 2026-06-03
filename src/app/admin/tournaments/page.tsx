"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TOURNAMENT_STATUSES,
  emptyTournament,
  emptyMatch,
  tournamentFromRow,
  matchFromRow,
  computeTopScorers,
  type Tournament,
  type Match,
  type TournamentMessage,
} from "@/lib/tournaments";

type Lite = { id: string; name: string };

export default function AdminTournamentsPage() {
  const supabase = createClient();
  const [list, setList] = useState<Tournament[]>([]);
  const [allTeams, setAllTeams] = useState<Lite[]>([]);
  const [allPlayers, setAllPlayers] = useState<Lite[]>([]);
  const [draft, setDraft] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<TournamentMessage[]>([]);
  const [newMatch, setNewMatch] = useState<Match>(emptyMatch());
  const [goalPlayer, setGoalPlayer] = useState("");
  const [goalCount, setGoalCount] = useState(1);
  const [newMessage, setNewMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const teamName = useMemo(() => {
    const m = new Map(allTeams.map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [allTeams]);
  const playerName = useMemo(() => {
    const m = new Map(allPlayers.map((p) => [p.id, p.name]));
    return (id: string) => m.get(id) ?? id;
  }, [allPlayers]);

  const loadLists = useCallback(async () => {
    const [t, te, pl] = await Promise.all([
      supabase
        .from("tournaments")
        .select("*, tournament_teams(team_id), tournament_players(player_id)")
        .order("created_at", { ascending: false }),
      supabase.from("teams").select("id, name").order("name"),
      supabase.from("players").select("id, name").order("name"),
    ]);
    if (!t.error && t.data) setList(t.data.map(tournamentFromRow));
    if (!te.error && te.data) setAllTeams(te.data as Lite[]);
    if (!pl.error && pl.data) setAllPlayers(pl.data as Lite[]);
  }, [supabase]);

  const loadSub = useCallback(
    async (tid: string) => {
      const [m, ms] = await Promise.all([
        supabase
          .from("matches")
          .select("*, match_goals(player_id, goals)")
          .eq("tournament_id", tid)
          .order("played_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("tournament_messages")
          .select("*")
          .eq("tournament_id", tid)
          .order("created_at", { ascending: false }),
      ]);
      setMatches(!m.error && m.data ? m.data.map(matchFromRow) : []);
      setMessages(
        !ms.error && ms.data
          ? ms.data.map((r: Record<string, unknown>) => ({
              id: r.id as string,
              body: String(r.body),
              createdAt: r.created_at as string,
            }))
          : [],
      );
    },
    [supabase],
  );

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  function select(t: Tournament | null) {
    setErr("");
    setMsg("");
    setNewMatch(emptyMatch());
    setNewMessage("");
    setDraft(t ? { ...t } : null);
    setMatches([]);
    setMessages([]);
    if (t?.id) loadSub(t.id);
  }

  function toggle(list: string[], id: string) {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function saveTournament() {
    if (!draft) return;
    if (!draft.name.trim()) return setErr("Informe o nome do torneio.");
    setBusy(true);
    setErr("");
    setMsg("");
    let tid = draft.id;
    const row = { name: draft.name.trim(), status: draft.status };
    if (tid) {
      const { error } = await supabase.from("tournaments").update(row).eq("id", tid);
      if (error) return finish(error.message);
    } else {
      const { data, error } = await supabase.from("tournaments").insert(row).select("id").single();
      if (error || !data) return finish(error?.message ?? "Erro ao criar torneio.");
      tid = data.id as string;
    }
    await supabase.from("tournament_teams").delete().eq("tournament_id", tid);
    if (draft.teamIds.length)
      await supabase
        .from("tournament_teams")
        .insert(draft.teamIds.map((team_id) => ({ tournament_id: tid, team_id })));
    await supabase.from("tournament_players").delete().eq("tournament_id", tid);
    if (draft.playerIds.length)
      await supabase
        .from("tournament_players")
        .insert(draft.playerIds.map((player_id) => ({ tournament_id: tid, player_id })));
    setBusy(false);
    setMsg(`Torneio "${draft.name}" salvo.`);
    setDraft({ ...draft, id: tid });
    await loadLists();
    await loadSub(tid!);
  }

  function finish(error: string) {
    setBusy(false);
    setErr(error);
  }

  async function removeTournament() {
    if (!draft?.id) return;
    if (!confirm(`Remover o torneio "${draft.name}"?`)) return;
    setBusy(true);
    const { error } = await supabase.from("tournaments").delete().eq("id", draft.id);
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg("Torneio removido.");
    select(null);
    await loadLists();
  }

  function addGoal() {
    if (!goalPlayer || goalCount < 1) return;
    setNewMatch((m) => ({ ...m, goals: [...m.goals, { playerId: goalPlayer, goals: goalCount }] }));
    setGoalPlayer("");
    setGoalCount(1);
  }

  async function addMatch() {
    if (!draft?.id) return;
    setBusy(true);
    setErr("");
    const { data, error } = await supabase
      .from("matches")
      .insert({
        tournament_id: draft.id,
        home_team_id: newMatch.homeTeamId,
        away_team_id: newMatch.awayTeamId,
        home_score: newMatch.homeScore,
        away_score: newMatch.awayScore,
        played_at: newMatch.playedAt || null,
        notes: newMatch.notes || null,
      })
      .select("id")
      .single();
    if (error || !data) return finish(error?.message ?? "Erro ao salvar súmula.");
    if (newMatch.goals.length) {
      const { error: ge } = await supabase
        .from("match_goals")
        .insert(newMatch.goals.map((g) => ({ match_id: data.id, player_id: g.playerId, goals: g.goals })));
      if (ge) return finish(ge.message);
    }
    setBusy(false);
    setNewMatch(emptyMatch());
    await loadSub(draft.id);
  }

  async function removeMatch(id?: string) {
    if (!id || !draft?.id) return;
    setBusy(true);
    await supabase.from("matches").delete().eq("id", id);
    setBusy(false);
    await loadSub(draft.id);
  }

  async function addMessage() {
    if (!draft?.id || !newMessage.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("tournament_messages")
      .insert({ tournament_id: draft.id, body: newMessage.trim() });
    setBusy(false);
    if (error) return setErr(error.message);
    setNewMessage("");
    await loadSub(draft.id);
  }

  async function removeMessage(id: string) {
    if (!draft?.id) return;
    setBusy(true);
    await supabase.from("tournament_messages").delete().eq("id", id);
    setBusy(false);
    await loadSub(draft.id);
  }

  const scorers = computeTopScorers(matches);
  const matchTeams = draft && draft.teamIds.length ? allTeams.filter((t) => draft.teamIds.includes(t.id)) : allTeams;

  const inputC = "border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded text-sm";

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

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        {/* LISTA */}
        <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-3 flex flex-col gap-3 h-max">
          <button
            onClick={() => select(emptyTournament())}
            className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg py-2 text-sm"
          >
            + Novo torneio
          </button>
          <ul className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto text-sm">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => select(t)}
                  className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-[#1d1d1d] ${
                    draft?.id === t.id ? "bg-[#1d1d1d] ring-1 ring-yellow-500" : ""
                  }`}
                >
                  <span className="truncate">{t.name}</span>
                  <span className="text-[10px] text-[#8d8d8d]">{t.status}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="text-xs text-[#8d8d8d] px-2 py-1">Nenhum torneio.</li>}
          </ul>
        </div>

        {/* EDITOR */}
        <div className="flex flex-col gap-4">
          {!draft ? (
            <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4 text-sm text-[#a9a9a9]">
              Selecione um torneio, ou clique em <b>+ Novo torneio</b>.
            </div>
          ) : (
            <>
              {/* BÁSICO + VÍNCULOS */}
              <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4 flex flex-col gap-4">
                <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    Nome do torneio
                    <input
                      className={inputC}
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    Status
                    <select
                      className={inputC}
                      value={draft.status}
                      onChange={(e) =>
                        setDraft({ ...draft, status: e.target.value as Tournament["status"] })
                      }
                    >
                      {TOURNAMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <Multi
                  label="Times participantes"
                  options={allTeams}
                  selected={draft.teamIds}
                  onToggle={(id) => setDraft({ ...draft, teamIds: toggle(draft.teamIds, id) })}
                />
                <Multi
                  label="Jogadores vinculados"
                  options={allPlayers}
                  selected={draft.playerIds}
                  onToggle={(id) => setDraft({ ...draft, playerIds: toggle(draft.playerIds, id) })}
                />

                <div className="flex justify-end gap-2 border-t border-[#454545] pt-3">
                  {draft.id && (
                    <button
                      onClick={removeTournament}
                      disabled={busy}
                      className="border border-red-800 text-red-300 rounded-lg px-4 py-2 text-sm hover:bg-red-950 disabled:opacity-60"
                    >
                      Remover
                    </button>
                  )}
                  <button
                    onClick={saveTournament}
                    disabled={busy}
                    className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg px-5 py-2 text-sm disabled:opacity-60"
                  >
                    {busy ? "Salvando…" : "Salvar torneio"}
                  </button>
                </div>
              </div>

              {!draft.id ? (
                <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4 text-xs text-[#a9a9a9]">
                  Salve o torneio para adicionar súmulas e mensagens.
                </div>
              ) : (
                <>
                  {/* ARTILHARIA */}
                  <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4">
                    <h3 className="font-bold text-sm mb-2">Artilharia (automática pelas súmulas)</h3>
                    {scorers.length === 0 ? (
                      <p className="text-xs text-[#8d8d8d]">Sem gols registrados ainda.</p>
                    ) : (
                      <ol className="text-sm flex flex-col gap-1">
                        {scorers.map((s, i) => (
                          <li key={s.playerId} className="flex justify-between">
                            <span>
                              <span className="text-[#8d8d8d] mr-2">{i + 1}</span>
                              {playerName(s.playerId)}
                            </span>
                            <span className="text-yellow-500 font-bold">{s.goals}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* SÚMULAS */}
                  <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4">
                    <h3 className="font-bold text-sm mb-3">Súmulas ({matches.length})</h3>

                    <ul className="flex flex-col gap-2 mb-4">
                      {matches.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between bg-[#1d1d1d] rounded-lg px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">
                              {teamName(m.homeTeamId)} {m.homeScore} × {m.awayScore}{" "}
                              {teamName(m.awayTeamId)}
                            </span>
                            <span className="text-[#8d8d8d] text-xs ml-2">{m.playedAt ?? ""}</span>
                            {m.goals.length > 0 && (
                              <div className="text-[10px] text-[#8d8d8d]">
                                ⚽ {m.goals.map((g) => `${playerName(g.playerId)} (${g.goals})`).join(", ")}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => removeMatch(m.id)}
                            className="text-red-400 text-xs hover:underline"
                          >
                            remover
                          </button>
                        </li>
                      ))}
                      {matches.length === 0 && (
                        <li className="text-xs text-[#8d8d8d]">Nenhuma súmula ainda.</li>
                      )}
                    </ul>

                    {/* nova súmula */}
                    <div className="border-t border-[#454545] pt-3 flex flex-col gap-2">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                        <label className="flex flex-col gap-1 text-[11px] col-span-2 sm:col-span-1">
                          Mandante
                          <select
                            className={inputC}
                            value={newMatch.homeTeamId ?? ""}
                            onChange={(e) =>
                              setNewMatch({ ...newMatch, homeTeamId: e.target.value || null })
                            }
                          >
                            <option value="">—</option>
                            {matchTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-[11px]">
                          Gols M
                          <input
                            type="number"
                            min={0}
                            className={inputC}
                            value={newMatch.homeScore}
                            onChange={(e) =>
                              setNewMatch({ ...newMatch, homeScore: Number(e.target.value) || 0 })
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px]">
                          Gols V
                          <input
                            type="number"
                            min={0}
                            className={inputC}
                            value={newMatch.awayScore}
                            onChange={(e) =>
                              setNewMatch({ ...newMatch, awayScore: Number(e.target.value) || 0 })
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] col-span-2 sm:col-span-1">
                          Visitante
                          <select
                            className={inputC}
                            value={newMatch.awayTeamId ?? ""}
                            onChange={(e) =>
                              setNewMatch({ ...newMatch, awayTeamId: e.target.value || null })
                            }
                          >
                            <option value="">—</option>
                            {matchTeams.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-[11px]">
                          Data
                          <input
                            type="date"
                            className={inputC}
                            value={newMatch.playedAt ?? ""}
                            onChange={(e) =>
                              setNewMatch({ ...newMatch, playedAt: e.target.value || null })
                            }
                          />
                        </label>
                      </div>

                      {/* gols por jogador */}
                      <div className="flex flex-wrap items-end gap-2 bg-[#1d1d1d] rounded-lg p-2">
                        <label className="flex flex-col gap-1 text-[11px]">
                          Goleador
                          <select
                            className={inputC}
                            value={goalPlayer}
                            onChange={(e) => setGoalPlayer(e.target.value)}
                          >
                            <option value="">Selecione…</option>
                            {allPlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] w-16">
                          Gols
                          <input
                            type="number"
                            min={1}
                            className={inputC}
                            value={goalCount}
                            onChange={(e) => setGoalCount(Number(e.target.value) || 1)}
                          />
                        </label>
                        <button
                          onClick={addGoal}
                          className="border border-[#454545] rounded-lg px-3 py-2 text-xs hover:bg-[#2f2f2f]"
                        >
                          + gol
                        </button>
                        {newMatch.goals.map((g, i) => (
                          <span
                            key={i}
                            className="bg-yellow-500 text-yellow-900 rounded-full px-2 py-0.5 text-[11px]"
                          >
                            {playerName(g.playerId)} ({g.goals})
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={addMatch}
                        disabled={busy}
                        className="self-start bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60"
                      >
                        Adicionar súmula
                      </button>
                    </div>
                  </div>

                  {/* MENSAGENS */}
                  <div className="bg-[#2f2f2f] border border-[#454545] rounded-xl p-4">
                    <h3 className="font-bold text-sm mb-3">Mensagens ({messages.length})</h3>
                    <ul className="flex flex-col gap-2 mb-3">
                      {messages.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-start justify-between bg-[#1d1d1d] rounded-lg px-3 py-2 text-sm"
                        >
                          <span className="whitespace-pre-wrap">{m.body}</span>
                          <button
                            onClick={() => removeMessage(m.id)}
                            className="text-red-400 text-xs hover:underline ml-3 shrink-0"
                          >
                            remover
                          </button>
                        </li>
                      ))}
                      {messages.length === 0 && (
                        <li className="text-xs text-[#8d8d8d]">Nenhuma mensagem ainda.</li>
                      )}
                    </ul>
                    <div className="flex gap-2">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escreva um aviso/mensagem do campeonato..."
                        className={`${inputC} flex-1 min-h-[44px]`}
                      />
                      <button
                        onClick={addMessage}
                        disabled={busy}
                        className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900 font-bold rounded-lg px-4 py-2 text-sm disabled:opacity-60 self-stretch"
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Multi-seleção reutilizável (chips selecionados + busca + lista) */
function Multi({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const nameById = new Map(options.map((o) => [o.id, o.name]));
  const filtered = options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase().trim()));
  return (
    <div>
      <div className="text-xs font-bold mb-1">
        {label} ({selected.length})
      </div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((id) => (
            <button
              key={id}
              onClick={() => onToggle(id)}
              className="bg-yellow-500 text-yellow-900 rounded-full px-2 py-0.5 text-xs"
            >
              {nameById.get(id) ?? id} ✕
            </button>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar para adicionar..."
        className="text-xs border border-[#8d8d8d68] bg-[#1d1d1d] p-2 rounded w-full mb-1"
      />
      <ul className="flex flex-col gap-0.5 max-h-[160px] overflow-y-auto text-sm border border-[#454545] rounded-lg p-1">
        {filtered.slice(0, 50).map((o) => {
          const sel = selected.includes(o.id);
          return (
            <li key={o.id}>
              <button
                onClick={() => onToggle(o.id)}
                className={`w-full text-left rounded px-2 py-1 hover:bg-[#1d1d1d] flex justify-between ${
                  sel ? "text-yellow-500" : ""
                }`}
              >
                {o.name}
                <span>{sel ? "✓" : "+"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
