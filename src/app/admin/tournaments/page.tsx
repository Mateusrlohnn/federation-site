"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
import {
  TOURNAMENT_STATUSES,
  MATCH_EVENT_TYPES,
  emptyTournament,
  emptyMatch,
  tournamentFromRow,
  matchFromRow,
  computeTopScorers,
  teamGoals,
  type Tournament,
  type Match,
  type MatchEventType,
  type TournamentMessage,
} from "@/lib/tournaments";

type Lite = { id: string; name: string };

const eventEmoji = (t: MatchEventType) => MATCH_EVENT_TYPES.find((x) => x.type === t)?.emoji ?? "";

export default function AdminTournamentsPage() {
  const supabase = createClient();
  const [list, setList] = useState<Tournament[]>([]);
  const [allTeams, setAllTeams] = useState<Lite[]>([]);
  const [allPlayers, setAllPlayers] = useState<Lite[]>([]);
  const [rosters, setRosters] = useState<Record<string, string[]>>({}); // teamId -> playerIds
  const [draft, setDraft] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<TournamentMessage[]>([]);
  const [newMatch, setNewMatch] = useState<Match>(emptyMatch());
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [liveMode, setLiveMode] = useState(false); // editor de partida ao vivo
  const [scheduledMode, setScheduledMode] = useState(false); // editor de partida agendada
  const [evPlayer, setEvPlayer] = useState("");
  const [evType, setEvType] = useState<MatchEventType>("goal");
  const [evMinute, setEvMinute] = useState("");
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
    const [t, te, pl, tp] = await Promise.all([
      supabase
        .from("tournaments")
        .select("*, tournament_teams(team_id), tournament_players(player_id)")
        .order("created_at", { ascending: false }),
      supabase.from("teams").select("id, name").order("name"),
      supabase.from("players").select("id, name").order("name"),
      supabase.from("team_players").select("team_id, player_id"),
    ]);
    if (!t.error && t.data) setList(t.data.map(tournamentFromRow));
    if (!te.error && te.data) setAllTeams(te.data as Lite[]);
    if (!pl.error && pl.data) setAllPlayers(pl.data as Lite[]);
    if (!tp.error && tp.data) {
      const map: Record<string, string[]> = {};
      (tp.data as { team_id: string; player_id: string }[]).forEach((r) => {
        (map[r.team_id] ??= []).push(r.player_id);
      });
      setRosters(map);
    }
  }, [supabase]);

  const loadSub = useCallback(
    async (tid: string) => {
      const [m, ms] = await Promise.all([
        supabase
          .from("matches")
          .select("*, match_events(player_id, team_id, type, minute)")
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
    setEditorOpen(false);
    setLiveMode(false);
    setScheduledMode(false);
    setEvPlayer("");
    setEvType("goal");
    setEvMinute("");
  }

  function startSumula() {
    resetMatchForm();
    setNewMatch(emptyMatch());
    setEditorOpen(true);
  }

  function startLive() {
    resetMatchForm();
    setNewMatch({ ...emptyMatch(), isLive: true });
    setLiveMode(true);
    setEditorOpen(true);
  }

  function startScheduled() {
    resetMatchForm();
    setNewMatch({ ...emptyMatch(), scheduled: true });
    setScheduledMode(true);
    setEditorOpen(true);
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
      logo_url: draft.logoUrl?.trim() || null,
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

  // jogadores elegíveis = elenco dos 2 times selecionados (com o time de origem)
  function eligiblePlayers(): { id: string; name: string; teamId: string }[] {
    const out: { id: string; name: string; teamId: string }[] = [];
    const seen = new Set<string>();
    for (const teamId of [newMatch.homeTeamId, newMatch.awayTeamId]) {
      if (!teamId) continue;
      for (const pid of rosters[teamId] ?? []) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        out.push({ id: pid, name: playerName(pid), teamId });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  function addEvent() {
    if (!evPlayer) return;
    const teamId = eligiblePlayers().find((p) => p.id === evPlayer)?.teamId ?? null;
    const minute = evMinute.trim() === "" ? null : Number(evMinute) || 0;
    setNewMatch((m) => ({
      ...m,
      events: [...m.events, { playerId: evPlayer, teamId, type: evType, minute }],
    }));
    setEvPlayer("");
    setEvMinute("");
  }

  function removeEvent(i: number) {
    setNewMatch((m) => ({ ...m, events: m.events.filter((_, idx) => idx !== i) }));
  }

  function editMatch(m: Match) {
    setEditingMatchId(m.id ?? null);
    setNewMatch({ ...m });
    setLiveMode(m.isLive);
    setScheduledMode(m.scheduled);
    setEditorOpen(true);
    setEvPlayer("");
    setEvType("goal");
    setEvMinute("");
    setErr("");
    setMsg("");
  }

  // endLive: força o fim da partida (vira súmula) e mantém o editor aberto p/ MVP
  async function saveMatch(opts?: { endLive?: boolean }) {
    if (!draft?.id) return;
    setBusy(true);
    setErr("");
    const scheduled = scheduledMode;
    const isLive = opts?.endLive || scheduled ? false : newMatch.isLive;
    // MVP só vale para partida encerrada (não ao vivo / não agendada)
    const mvp = isLive || scheduled ? null : newMatch.mvpPlayerId;
    const row = {
      tournament_id: draft.id,
      home_team_id: newMatch.homeTeamId,
      away_team_id: newMatch.awayTeamId,
      // placar automático: derivado dos gols (gol normal + pênalti convertido)
      home_score: teamGoals(newMatch.events, newMatch.homeTeamId),
      away_score: teamGoals(newMatch.events, newMatch.awayTeamId),
      is_live: isLive,
      scheduled,
      mvp_player_id: mvp,
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

    // sincroniza eventos (apaga e regrava)
    await supabase.from("match_events").delete().eq("match_id", matchId);
    if (newMatch.events.length) {
      const { error: ee } = await supabase.from("match_events").insert(
        newMatch.events.map((e) => ({
          match_id: matchId,
          player_id: e.playerId,
          team_id: e.teamId,
          type: e.type,
          minute: e.minute,
        })),
      );
      if (ee) return finish(ee.message);
    }

    setBusy(false);
    await loadSub(draft.id);

    if (opts?.endLive) {
      // partida encerrada vira súmula: continua editável para definir o MVP
      setMsg("Partida encerrada! Súmula criada — defina o MVP, se quiser.");
      setNewMatch((m) => ({ ...m, isLive: false, scheduled: false }));
      setEditingMatchId(matchId);
      setLiveMode(false);
      setScheduledMode(false);
      setEditorOpen(true);
    } else if (scheduled) {
      setMsg(editingMatchId ? "Agendamento atualizado." : "Partida agendada.");
      resetMatchForm();
    } else {
      setMsg(editingMatchId ? "Súmula atualizada." : isLive ? "Partida ao vivo salva." : "Súmula adicionada.");
      if (isLive) {
        // mantém o editor da partida ao vivo aberto para continuar atualizando
        setEditingMatchId(matchId);
        setEditorOpen(true);
        setLiveMode(true);
      } else {
        resetMatchForm();
      }
    }
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
  const sumulas = matches.filter((m) => !m.isLive && !m.scheduled);
  const liveMatches = matches.filter((m) => m.isLive);
  const scheduledMatches = matches.filter((m) => m.scheduled);
  // placar automático do rascunho (derivado dos gols)
  const draftScoreA = teamGoals(newMatch.events, newMatch.homeTeamId);
  const draftScoreB = teamGoals(newMatch.events, newMatch.awayTeamId);

  const inputC =
    "rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50";

  function renderMatchRow(m: Match) {
    return (
      <li
        key={m.id}
        className={`flex items-center justify-between rounded-md bg-panel px-3 py-2 text-sm ${
          editingMatchId === m.id ? "ring-1 ring-gold" : ""
        }`}
      >
        <div className="min-w-0">
          <span className="font-medium">
            {teamName(m.homeTeamId)} {m.homeScore} × {m.awayScore} {teamName(m.awayTeamId)}
          </span>
          {m.isLive && (
            <span className="ml-2 rounded bg-loss px-1.5 py-0.5 text-[10px] font-bold text-white">
              AO VIVO
            </span>
          )}
          <span className="ml-2 text-xs text-faint">{m.playedAt ?? ""}</span>
          {m.events.length > 0 && (
            <div className="text-[10px] text-faint">
              {m.events
                .map(
                  (e) =>
                    `${eventEmoji(e.type)} ${playerName(e.playerId)}${
                      e.minute != null ? ` ${e.minute}'` : ""
                    }`,
                )
                .join("  ·  ")}
            </div>
          )}
          {m.mvpPlayerId && (
            <div className="text-[10px] font-semibold text-gold">
              ⭐ MVP: {playerName(m.mvpPlayerId)}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => editMatch(m)} className="text-xs text-gold hover:underline">
            editar
          </button>
          <button onClick={() => removeMatch(m.id)} className="text-xs text-loss hover:underline">
            remover
          </button>
        </div>
      </li>
    );
  }

  function renderEditor() {
    const bothTeams = !!newMatch.homeTeamId && !!newMatch.awayTeamId;
    return (
      <div className="mt-3 flex flex-col gap-2 border-t border-white/5 pt-3">
        <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-5">
          <label className="col-span-2 flex flex-col gap-1 text-[11px] sm:col-span-1">
            Time A
            <select
              className={inputC}
              value={newMatch.homeTeamId ?? ""}
              onChange={(e) => setNewMatch({ ...newMatch, homeTeamId: e.target.value || null })}
            >
              <option value="">—</option>
              {matchTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-[11px]">
            <span>Placar (automático)</span>
            <div className="flex h-[38px] items-center justify-center gap-2 rounded-md bg-base text-lg font-extrabold tabular-nums">
              <span>{draftScoreA}</span>
              <span className="text-sm text-faint">×</span>
              <span>{draftScoreB}</span>
            </div>
          </div>
          <label className="col-span-2 flex flex-col gap-1 text-[11px] sm:col-span-1">
            Time B
            <select
              className={inputC}
              value={newMatch.awayTeamId ?? ""}
              onChange={(e) => setNewMatch({ ...newMatch, awayTeamId: e.target.value || null })}
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
              onChange={(e) => setNewMatch({ ...newMatch, playedAt: e.target.value || null })}
            />
          </label>
        </div>

        {scheduledMode ? (
          <p className="rounded-md bg-panel p-2 text-[11px] text-faint">
            Defina os dois times e a data. Para lançar gols, cartões e MVP, clique em
            “Registrar resultado” ou “Iniciar ao vivo”.
          </p>
        ) : (
          <>
        {/* eventos (gols, pênaltis, assistências, cartões) */}
        <div className="flex flex-col gap-2 rounded-md bg-panel p-2">
          {!bothTeams ? (
            <span className="text-[11px] text-faint">
              Selecione os dois times para registrar os eventos dos jogadores.
            </span>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-[11px]">
                  Jogador
                  <select
                    className={inputC}
                    value={evPlayer}
                    onChange={(e) => setEvPlayer(e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {[newMatch.homeTeamId, newMatch.awayTeamId].map((tid) => (
                      <optgroup key={tid} label={teamName(tid)}>
                        {eligiblePlayers()
                          .filter((p) => p.teamId === tid)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px]">
                  Evento
                  <select
                    className={inputC}
                    value={evType}
                    onChange={(e) => setEvType(e.target.value as MatchEventType)}
                  >
                    {MATCH_EVENT_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex w-16 flex-col gap-1 text-[11px]">
                  Minuto
                  <input
                    type="number"
                    min={0}
                    placeholder="ex: 4"
                    className={inputC}
                    value={evMinute}
                    onChange={(e) => setEvMinute(e.target.value)}
                  />
                </label>
                <button
                  onClick={addEvent}
                  className="rounded-md bg-base px-3 py-2 text-xs hover:bg-base/70"
                >
                  + evento
                </button>
              </div>
              {newMatch.events.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {newMatch.events.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => removeEvent(i)}
                      title="Remover evento"
                      className="rounded-md bg-base px-2 py-0.5 text-[11px]"
                    >
                      {eventEmoji(e.type)} {playerName(e.playerId)}
                      {e.minute != null ? ` ${e.minute}'` : ""} ✕
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* MVP (só em súmula encerrada) */}
        {liveMode ? (
          <p className="text-[11px] text-faint">
            ⭐ O MVP poderá ser definido após clicar em <b>Encerrar partida</b>.
          </p>
        ) : (
          <label className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold">⭐ MVP da partida</span>
            <select
              className={inputC}
              value={newMatch.mvpPlayerId ?? ""}
              onChange={(e) => setNewMatch({ ...newMatch, mvpPlayerId: e.target.value || null })}
              disabled={!bothTeams}
            >
              <option value="">— Sem MVP —</option>
              {eligiblePlayers().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
          </>
        )}

        {/* ações */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => saveMatch()}
            disabled={busy}
            className="rounded-md bg-gold px-4 py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
          >
            {busy
              ? "Salvando…"
              : scheduledMode
                ? editingMatchId
                  ? "Salvar agendamento"
                  : "Agendar partida"
                : liveMode
                  ? editingMatchId
                    ? "Salvar ao vivo"
                    : "Iniciar partida ao vivo"
                  : editingMatchId
                    ? "Salvar alterações"
                    : "Adicionar súmula"}
          </button>
          {liveMode && editingMatchId && (
            <button
              onClick={() => saveMatch({ endLive: true })}
              disabled={busy}
              className="rounded-md bg-loss px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              ⏹ Encerrar partida
            </button>
          )}
          {scheduledMode && (
            <>
              <button
                onClick={() => {
                  setScheduledMode(false);
                  setLiveMode(false);
                  setNewMatch((m) => ({ ...m, scheduled: false, isLive: false }));
                }}
                disabled={busy}
                className="rounded-md bg-win px-4 py-2 text-sm font-bold text-[#0a1f10] hover:opacity-90 disabled:opacity-60"
              >
                Registrar resultado
              </button>
              <button
                onClick={() => {
                  setScheduledMode(false);
                  setLiveMode(true);
                  setNewMatch((m) => ({ ...m, scheduled: false, isLive: true }));
                }}
                disabled={busy}
                className="rounded-md bg-loss px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                Iniciar ao vivo
              </button>
            </>
          )}
          <button
            onClick={resetMatchForm}
            disabled={busy}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-faint hover:bg-panel disabled:opacity-60"
          >
            {editingMatchId ? "Fechar" : "Cancelar"}
          </button>
        </div>
      </div>
    );
  }

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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <ImageUpload
                    label="Foto do torneio (quadrada)"
                    folder="tournaments"
                    value={draft.logoUrl}
                    onChange={(url) => setDraft({ ...draft, logoUrl: url })}
                  />
                  <div className="flex-1">
                    <ImageUpload
                      label="Banner do campeonato (imagem larga)"
                      folder="tournaments"
                      shape="wide"
                      value={draft.imageUrl}
                      onChange={(url) => setDraft({ ...draft, imageUrl: url })}
                    />
                  </div>
                </div>

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

                  {/* SÚMULAS (partidas finalizadas) */}
                  <div className="rounded-lg bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">Súmulas ({sumulas.length})</h3>
                      <button
                        onClick={startSumula}
                        className="rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-[#1a1a1e] hover:opacity-90"
                      >
                        + Nova súmula
                      </button>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {sumulas.map((m) => renderMatchRow(m))}
                      {sumulas.length === 0 && (
                        <li className="text-xs text-faint">Nenhuma súmula ainda.</li>
                      )}
                    </ul>
                    {editorOpen && !liveMode && !scheduledMode && renderEditor()}
                  </div>

                  {/* PARTIDA AO VIVO */}
                  <div className="rounded-lg bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-bold">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              liveMatches.length ? "animate-pulse bg-loss" : "bg-faint"
                            }`}
                          />
                          Partida ao vivo ({liveMatches.length})
                        </span>
                      </h3>
                      <button
                        onClick={startLive}
                        className="rounded-md bg-loss px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                      >
                        + Iniciar partida ao vivo
                      </button>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {liveMatches.map((m) => renderMatchRow(m))}
                      {liveMatches.length === 0 && (
                        <li className="text-xs text-faint">Nenhuma partida ao vivo.</li>
                      )}
                    </ul>
                    {editorOpen && liveMode && renderEditor()}
                  </div>

                  {/* PRÓXIMAS PARTIDAS (agendadas) */}
                  <div className="rounded-lg bg-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">Próximas partidas ({scheduledMatches.length})</h3>
                      <button
                        onClick={startScheduled}
                        className="rounded-md bg-draw px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                      >
                        + Agendar partida
                      </button>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {scheduledMatches.map((m) => renderMatchRow(m))}
                      {scheduledMatches.length === 0 && (
                        <li className="text-xs text-faint">Nenhuma partida agendada.</li>
                      )}
                    </ul>
                    {editorOpen && scheduledMode && renderEditor()}
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
