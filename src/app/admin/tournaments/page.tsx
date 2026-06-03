"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
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
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [goalPlayer, setGoalPlayer] = useState("");
  const [goalCount, setGoalCount] = useState(1);
  const [goalMinute, setGoalMinute] = useState("");
  const [assistPlayer, setAssistPlayer] = useState("");
  const [assistCount, setAssistCount] = useState(1);
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
          .select("*, match_goals(player_id, goals, minute), match_assists(player_id, assists)")
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
    resetMatchForm();
    setNewMessage("");
    setDraft(t ? { ...t } : null);
    setMatches([]);
    setMessages([]);
    if (t?.id) loadSub(t.id);
  }

  function resetMatchForm() {
    setNewMatch(emptyMatch());
    setEditingMatchId(null);
    setGoalPlayer("");
    setGoalCount(1);
    setGoalMinute("");
    setAssistPlayer("");
    setAssistCount(1);
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
    // só grava campeão se o time ainda for participante
    const champion =
      draft.championTeamId && draft.teamIds.includes(draft.championTeamId)
        ? draft.championTeamId
        : null;
    const row = {
      name: draft.name.trim(),
      status: draft.status,
      image_url: draft.imageUrl?.trim() || null,
      champion_team_id: champion,
      organizer_id: draft.organizerId || null,
    };
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
    const minute = goalMinute.trim() === "" ? null : Number(goalMinute) || 0;
    setNewMatch((m) => ({
      ...m,
      goals: [...m.goals, { playerId: goalPlayer, goals: goalCount, minute }],
    }));
    setGoalPlayer("");
    setGoalCount(1);
    setGoalMinute("");
  }

  function removeGoal(i: number) {
    setNewMatch((m) => ({ ...m, goals: m.goals.filter((_, idx) => idx !== i) }));
  }

  function addAssist() {
    if (!assistPlayer || assistCount < 1) return;
    setNewMatch((m) => ({
      ...m,
      assists: [...m.assists, { playerId: assistPlayer, assists: assistCount }],
    }));
    setAssistPlayer("");
    setAssistCount(1);
  }

  function removeAssist(i: number) {
    setNewMatch((m) => ({ ...m, assists: m.assists.filter((_, idx) => idx !== i) }));
  }

  function editMatch(m: Match) {
    setEditingMatchId(m.id ?? null);
    setNewMatch({ ...m });
    setGoalPlayer("");
    setGoalCount(1);
    setGoalMinute("");
    setAssistPlayer("");
    setAssistCount(1);
    setErr("");
    setMsg("");
  }

  async function saveMatch() {
    if (!draft?.id) return;
    setBusy(true);
    setErr("");
    const row = {
      tournament_id: draft.id,
      home_team_id: newMatch.homeTeamId,
      away_team_id: newMatch.awayTeamId,
      home_score: newMatch.homeScore,
      away_score: newMatch.awayScore,
      is_live: newMatch.isLive,
      played_at: newMatch.playedAt || null,
      notes: newMatch.notes || null,
    };

    let matchId = editingMatchId;
    if (matchId) {
      const { error } = await supabase.from("matches").update(row).eq("id", matchId);
      if (error) return finish(error.message);
    } else {
      const { data, error } = await supabase.from("matches").insert(row).select("id").single();
      if (error || !data) return finish(error?.message ?? "Erro ao salvar súmula.");
      matchId = data.id as string;
    }

    // sincroniza gols e assistências (apaga e regrava)
    await supabase.from("match_goals").delete().eq("match_id", matchId);
    if (newMatch.goals.length) {
      const { error: ge } = await supabase.from("match_goals").insert(
        newMatch.goals.map((g) => ({
          match_id: matchId,
          player_id: g.playerId,
          goals: g.goals,
          minute: g.minute,
        })),
      );
      if (ge) return finish(ge.message);
    }
    await supabase.from("match_assists").delete().eq("match_id", matchId);
    if (newMatch.assists.length) {
      const { error: ae } = await supabase.from("match_assists").insert(
        newMatch.assists.map((a) => ({
          match_id: matchId,
          player_id: a.playerId,
          assists: a.assists,
        })),
      );
      if (ae) return finish(ae.message);
    }

    setBusy(false);
    setMsg(editingMatchId ? "Súmula atualizada." : "Súmula adicionada.");
    resetMatchForm();
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

  const inputC =
    "rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50";

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

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* LISTA */}
        <div className="flex h-max flex-col gap-3 rounded-lg bg-card p-3">
          <button
            onClick={() => select(emptyTournament())}
            className="rounded-md bg-gold py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90"
          >
            + Novo torneio
          </button>
          <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto text-sm">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => select(t)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel ${
                    draft?.id === t.id ? "bg-panel ring-1 ring-gold" : ""
                  }`}
                >
                  {t.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.imageUrl}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] text-faint">{t.status}</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-2 py-1 text-xs text-faint">Nenhum torneio.</li>}
          </ul>
        </div>

        {/* EDITOR */}
        <div className="flex flex-col gap-4">
          {!draft ? (
            <div className="rounded-lg bg-card p-4 text-sm text-faint">
              Selecione um torneio, ou clique em <b>+ Novo torneio</b>.
            </div>
          ) : (
            <>
              {/* BÁSICO + VÍNCULOS */}
              <div className="flex flex-col gap-4 rounded-lg bg-card p-4">
                <ImageUpload
                  label="Banner do campeonato (imagem larga)"
                  folder="tournaments"
                  shape="wide"
                  value={draft.imageUrl}
                  onChange={(url) => setDraft({ ...draft, imageUrl: url })}
                />

                <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
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

                {/* ORGANIZADOR */}
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-bold">Organizador</span>
                  <select
                    className={inputC}
                    value={draft.organizerId ?? ""}
                    onChange={(e) => setDraft({ ...draft, organizerId: e.target.value || null })}
                  >
                    <option value="">— Sem organizador —</option>
                    {allPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* CAMPEÃO — define os títulos contados na página do time */}
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-bold">🏆 Time campeão</span>
                  {draft.teamIds.length === 0 ? (
                    <span className="text-faint">
                      Adicione times participantes para definir o campeão.
                    </span>
                  ) : (
                    <select
                      className={inputC}
                      value={draft.championTeamId ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, championTeamId: e.target.value || null })
                      }
                    >
                      <option value="">— Sem campeão / não definido —</option>
                      {allTeams
                        .filter((t) => draft.teamIds.includes(t.id))
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  )}
                </label>

                <div className="flex justify-end gap-2 border-t border-white/5 pt-3">
                  {draft.id && (
                    <button
                      onClick={removeTournament}
                      disabled={busy}
                      className="rounded-md border border-loss/40 px-4 py-2 text-sm text-loss hover:bg-loss/10 disabled:opacity-60"
                    >
                      Remover
                    </button>
                  )}
                  <button
                    onClick={saveTournament}
                    disabled={busy}
                    className="rounded-md bg-gold px-5 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Salvando…" : "Salvar torneio"}
                  </button>
                </div>
              </div>

              {!draft.id ? (
                <div className="rounded-lg bg-card p-4 text-xs text-faint">
                  Salve o torneio para adicionar súmulas e mensagens.
                </div>
              ) : (
                <>
                  {/* ARTILHARIA */}
                  <div className="rounded-lg bg-card p-4">
                    <h3 className="mb-2 text-sm font-bold">Artilharia (automática pelas súmulas)</h3>
                    {scorers.length === 0 ? (
                      <p className="text-xs text-faint">Sem gols registrados ainda.</p>
                    ) : (
                      <ol className="flex flex-col gap-1 text-sm">
                        {scorers.map((s, i) => (
                          <li key={s.playerId} className="flex justify-between">
                            <span>
                              <span className="mr-2 text-faint">{i + 1}</span>
                              {playerName(s.playerId)}
                            </span>
                            <span className="font-bold text-gold">{s.goals}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>

                  {/* SÚMULAS */}
                  <div className="rounded-lg bg-card p-4">
                    <h3 className="mb-3 text-sm font-bold">Súmulas ({matches.length})</h3>

                    <ul className="mb-4 flex flex-col gap-2">
                      {matches.map((m) => (
                        <li
                          key={m.id}
                          className={`flex items-center justify-between rounded-md bg-panel px-3 py-2 text-sm ${
                            editingMatchId === m.id ? "ring-1 ring-gold" : ""
                          }`}
                        >
                          <div>
                            <span className="font-medium">
                              {teamName(m.homeTeamId)} {m.homeScore} × {m.awayScore}{" "}
                              {teamName(m.awayTeamId)}
                            </span>
                            {m.isLive && (
                              <span className="ml-2 rounded bg-loss px-1.5 py-0.5 text-[10px] font-bold text-white">
                                AO VIVO
                              </span>
                            )}
                            <span className="ml-2 text-xs text-faint">{m.playedAt ?? ""}</span>
                            {m.goals.length > 0 && (
                              <div className="text-[10px] text-faint">
                                ⚽{" "}
                                {m.goals
                                  .map(
                                    (g) =>
                                      `${playerName(g.playerId)}${
                                        g.minute != null ? ` ${g.minute}'` : ""
                                      } (${g.goals})`,
                                  )
                                  .join(", ")}
                              </div>
                            )}
                            {m.assists.length > 0 && (
                              <div className="text-[10px] text-faint">
                                🅰{" "}
                                {m.assists
                                  .map((a) => `${playerName(a.playerId)} (${a.assists})`)
                                  .join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() => editMatch(m)}
                              className="text-xs text-gold hover:underline"
                            >
                              editar
                            </button>
                            <button
                              onClick={() => removeMatch(m.id)}
                              className="text-xs text-loss hover:underline"
                            >
                              remover
                            </button>
                          </div>
                        </li>
                      ))}
                      {matches.length === 0 && (
                        <li className="text-xs text-faint">Nenhuma súmula ainda.</li>
                      )}
                    </ul>

                    {/* nova súmula */}
                    <div className="flex flex-col gap-2 border-t border-white/5 pt-3">
                      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
                        <label className="col-span-2 flex flex-col gap-1 text-[11px] sm:col-span-1">
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
                        <label className="col-span-2 flex flex-col gap-1 text-[11px] sm:col-span-1">
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

                      {/* ao vivo */}
                      <label className="flex w-max items-center gap-2 rounded-md bg-panel px-3 py-2 text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={newMatch.isLive}
                          onChange={(e) => setNewMatch({ ...newMatch, isLive: e.target.checked })}
                          className="h-4 w-4 accent-[#ff1744]"
                        />
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              newMatch.isLive ? "animate-pulse bg-loss" : "bg-faint"
                            }`}
                          />
                          Partida ao vivo
                        </span>
                      </label>

                      {/* gols por jogador */}
                      <div className="flex flex-wrap items-end gap-2 rounded-md bg-panel p-2">
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
                        <label className="flex w-14 flex-col gap-1 text-[11px]">
                          Gols
                          <input
                            type="number"
                            min={1}
                            className={inputC}
                            value={goalCount}
                            onChange={(e) => setGoalCount(Number(e.target.value) || 1)}
                          />
                        </label>
                        <label className="flex w-16 flex-col gap-1 text-[11px]">
                          Minuto
                          <input
                            type="number"
                            min={0}
                            placeholder="ex: 4"
                            className={inputC}
                            value={goalMinute}
                            onChange={(e) => setGoalMinute(e.target.value)}
                          />
                        </label>
                        <button
                          onClick={addGoal}
                          className="rounded-md bg-base px-3 py-2 text-xs hover:bg-base/70"
                        >
                          + gol
                        </button>
                        {newMatch.goals.map((g, i) => (
                          <button
                            key={i}
                            onClick={() => removeGoal(i)}
                            title="Remover gol"
                            className="rounded-md bg-gold px-2 py-0.5 text-[11px] text-[#1a1a1e]"
                          >
                            {playerName(g.playerId)}
                            {g.minute != null ? ` ${g.minute}'` : ""} ({g.goals}) ✕
                          </button>
                        ))}
                      </div>

                      {/* assistências por jogador */}
                      <div className="flex flex-wrap items-end gap-2 rounded-md bg-panel p-2">
                        <label className="flex flex-col gap-1 text-[11px]">
                          Assistência
                          <select
                            className={inputC}
                            value={assistPlayer}
                            onChange={(e) => setAssistPlayer(e.target.value)}
                          >
                            <option value="">Selecione…</option>
                            {allPlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex w-14 flex-col gap-1 text-[11px]">
                          Assist.
                          <input
                            type="number"
                            min={1}
                            className={inputC}
                            value={assistCount}
                            onChange={(e) => setAssistCount(Number(e.target.value) || 1)}
                          />
                        </label>
                        <button
                          onClick={addAssist}
                          className="rounded-md bg-base px-3 py-2 text-xs hover:bg-base/70"
                        >
                          + assist.
                        </button>
                        {newMatch.assists.map((a, i) => (
                          <button
                            key={i}
                            onClick={() => removeAssist(i)}
                            title="Remover assistência"
                            className="rounded-md bg-draw px-2 py-0.5 text-[11px] text-white"
                          >
                            {playerName(a.playerId)} ({a.assists}) ✕
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveMatch}
                          disabled={busy}
                          className="rounded-md bg-gold px-4 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
                        >
                          {busy
                            ? "Salvando…"
                            : editingMatchId
                              ? "Salvar alterações"
                              : "Adicionar súmula"}
                        </button>
                        {editingMatchId && (
                          <button
                            onClick={resetMatchForm}
                            disabled={busy}
                            className="rounded-md border border-white/10 px-4 py-2 text-sm text-faint hover:bg-panel disabled:opacity-60"
                          >
                            Cancelar edição
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* MENSAGENS */}
                  <div className="rounded-lg bg-card p-4">
                    <h3 className="mb-3 text-sm font-bold">Mensagens ({messages.length})</h3>
                    <ul className="mb-3 flex flex-col gap-2">
                      {messages.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-start justify-between rounded-md bg-panel px-3 py-2 text-sm"
                        >
                          <span className="whitespace-pre-wrap">{m.body}</span>
                          <button
                            onClick={() => removeMessage(m.id)}
                            className="ml-3 shrink-0 text-xs text-loss hover:underline"
                          >
                            remover
                          </button>
                        </li>
                      ))}
                      {messages.length === 0 && (
                        <li className="text-xs text-faint">Nenhuma mensagem ainda.</li>
                      )}
                    </ul>
                    <div className="flex gap-2">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escreva um aviso/mensagem do campeonato..."
                        className={`${inputC} min-h-[44px] flex-1`}
                      />
                      <button
                        onClick={addMessage}
                        disabled={busy}
                        className="self-stretch rounded-md bg-gold px-4 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
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
      <div className="mb-1 text-xs font-bold">
        {label} ({selected.length})
      </div>
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <button
              key={id}
              onClick={() => onToggle(id)}
              className="rounded-md bg-gold px-2 py-0.5 text-xs text-[#1a1a1e]"
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
        className="mb-1 w-full rounded-md bg-panel p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
      />
      <ul className="flex max-h-[160px] flex-col gap-0.5 overflow-y-auto rounded-md bg-panel p-1 text-sm">
        {filtered.slice(0, 50).map((o) => {
          const sel = selected.includes(o.id);
          return (
            <li key={o.id}>
              <button
                onClick={() => onToggle(o.id)}
                className={`flex w-full justify-between rounded px-2 py-1 text-left hover:bg-base ${
                  sel ? "text-gold" : ""
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
