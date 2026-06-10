"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
import SwissAdminPanel from "@/components/tournaments/SwissAdminPanel";
import {
  TOURNAMENT_STATUSES,
  MATCH_EVENT_TYPES,
  emptyTournament,
  emptyMatch,
  tournamentFromRow,
  matchFromRow,
  computeTopScorers,
  matchScore,
  gradeClass,
  GRADES,
  type Tournament,
  type Match,
  type MatchEventType,
  type MatchLineup,
  type Grade,
  type TournamentMessage,
} from "@/lib/tournaments";
import { POSITIONS, type Position } from "@/lib/teams";
import { avatarUrl } from "@/lib/hof";
import { focusStyle } from "@/lib/imageFocus";

import {
  TOURNAMENT_FORMATS,
  generateRoundRobin,
  splitGroups,
  suggestGroupCount,
  buildKnockout,
  computeSwissRecords,
  generateSwissPairs,
  playedPairs,
  pairKey,
  BYE,
  type TournamentFormat,
  type Pairing,
} from "@/lib/formats";

type Lite = { id: string; name: string };

const eventEmoji = (t: MatchEventType) => MATCH_EVENT_TYPES.find((x) => x.type === t)?.emoji ?? "";

// sentinela do W.O. duplo (os dois times faltaram -> 0×0). Não é id de time.
const WO_BOTH = "__both__";

export default function AdminTournamentsPage() {
  const supabase = createClient();
  const [list, setList] = useState<Tournament[]>([]);
  const [allTeams, setAllTeams] = useState<Lite[]>([]);
  const [allPlayers, setAllPlayers] = useState<Lite[]>([]);
  const [playerPos, setPlayerPos] = useState<Record<string, Position | null>>({}); // posição natural
  const [playerNick, setPlayerNick] = useState<Record<string, string>>({}); // nick p/ avatar
  // teamId -> jogadores do elenco (com a posição no time)
  const [rosters, setRosters] = useState<Record<string, { playerId: string; position: Position | null }[]>>(
    {},
  );
  const [draft, setDraft] = useState<Tournament | null>(null);
  // teamId -> rótulo do grupo ("Grupo A"...) para atribuição manual nos formatos com grupos
  const [teamGroups, setTeamGroups] = useState<Record<string, string>>({});
  // jogadores campeões / vice-campeões DESTA copa (subconjunto do elenco do time)
  const [championPlayers, setChampionPlayers] = useState<string[]>([]);
  const [runnerUpPlayers, setRunnerUpPlayers] = useState<string[]>([]);
  // elenco por time NESTA copa: teamId -> [{ playerId, position(naquela copa) }]
  const [teamSquads, setTeamSquads] = useState<
    Record<string, { playerId: string; position: Position | null }[]>
  >({});
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<TournamentMessage[]>([]);
  const [awards, setAwards] = useState<Record<string, string>>({}); // award_key -> player_id
  const [newMatch, setNewMatch] = useState<Match>(emptyMatch());
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [liveMode, setLiveMode] = useState(false); // editor de partida ao vivo
  const [scheduledMode, setScheduledMode] = useState(false); // editor de partida agendada
  const [evPlayer, setEvPlayer] = useState("");
  const [evType, setEvType] = useState<MatchEventType>("goal");
  const [evMinute, setEvMinute] = useState("");
  const [evOut, setEvOut] = useState(""); // substituição: jogador que sai
  const [evIn, setEvIn] = useState(""); // substituição: jogador que entra
  const [penPlayer, setPenPlayer] = useState(""); // cobrador na disputa de pênaltis
  const [woTeam, setWoTeam] = useState<string | null>(null); // time beneficiado por W.O. (null = não é W.O.)
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
      supabase.from("players").select("id, name, nick, position").order("name"),
      supabase.from("team_players").select("team_id, player_id, position"),
    ]);
    if (!t.error && t.data) setList(t.data.map(tournamentFromRow));
    if (!te.error && te.data) setAllTeams(te.data as Lite[]);
    if (!pl.error && pl.data) {
      const players = pl.data as {
        id: string;
        name: string;
        nick: string | null;
        position: Position | null;
      }[];
      setAllPlayers(players.map((p) => ({ id: p.id, name: p.name })));
      const pos: Record<string, Position | null> = {};
      const nick: Record<string, string> = {};
      players.forEach((p) => {
        pos[p.id] = p.position ?? null;
        nick[p.id] = p.nick?.trim() || p.name;
      });
      setPlayerPos(pos);
      setPlayerNick(nick);
    }
    if (!tp.error && tp.data) {
      const map: Record<string, { playerId: string; position: Position | null }[]> = {};
      (tp.data as { team_id: string; player_id: string; position: Position | null }[]).forEach((r) => {
        (map[r.team_id] ??= []).push({ playerId: r.player_id, position: r.position ?? null });
      });
      setRosters(map);
    }
  }, [supabase]);

  const loadSub = useCallback(
    async (tid: string) => {
      const [m, ms, aw, tt, wp, sq] = await Promise.all([
        supabase
          .from("matches")
          .select(
            "*, match_events(player_id, team_id, type, minute, secondary_player_id), match_lineups(player_id, team_id, position, is_starter, rating)",
          )
          .eq("tournament_id", tid)
          .order("played_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("tournament_messages")
          .select("*")
          .eq("tournament_id", tid)
          .order("created_at", { ascending: false }),
        supabase.from("tournament_awards").select("award_key, player_id").eq("tournament_id", tid),
        supabase.from("tournament_teams").select("team_id, group_label").eq("tournament_id", tid),
        supabase
          .from("tournament_winner_players")
          .select("player_id, kind")
          .eq("tournament_id", tid),
        supabase
          .from("tournament_team_players")
          .select("team_id, player_id, position")
          .eq("tournament_id", tid),
      ]);
      const groups: Record<string, string> = {};
      if (!tt.error && tt.data)
        (tt.data as { team_id: string; group_label: string | null }[]).forEach((r) => {
          if (r.group_label) groups[r.team_id] = r.group_label;
        });
      setTeamGroups(groups);
      const champ: string[] = [];
      const runner: string[] = [];
      if (!wp.error && wp.data)
        (wp.data as { player_id: string; kind: string }[]).forEach((r) => {
          (r.kind === "runner_up" ? runner : champ).push(r.player_id);
        });
      setChampionPlayers(champ);
      setRunnerUpPlayers(runner);
      const squads: Record<string, { playerId: string; position: Position | null }[]> = {};
      if (!sq.error && sq.data)
        (sq.data as { team_id: string; player_id: string; position: unknown }[]).forEach((r) => {
          (squads[r.team_id] ??= []).push({
            playerId: r.player_id,
            position: (r.position as Position | null) ?? null,
          });
        });
      setTeamSquads(squads);
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
      const awMap: Record<string, string> = {};
      if (!aw.error && aw.data)
        (aw.data as { award_key: string; player_id: string }[]).forEach((x) => {
          awMap[x.award_key] = x.player_id;
        });
      setAwards(awMap);
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
    setAwards({});
    setTeamGroups({});
    setChampionPlayers([]);
    setRunnerUpPlayers([]);
    setTeamSquads({});
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
    setEvOut("");
    setEvIn("");
    setWoTeam(null);
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
    // só grava campeão/vice se o time ainda for participante
    const champion =
      draft.championTeamId && draft.teamIds.includes(draft.championTeamId)
        ? draft.championTeamId
        : null;
    const runnerUp =
      draft.runnerUpTeamId && draft.teamIds.includes(draft.runnerUpTeamId)
        ? draft.runnerUpTeamId
        : null;
    const row = {
      name: draft.name.trim(),
      status: draft.status,
      image_url: draft.imageUrl?.trim() || null,
      logo_url: draft.logoUrl?.trim() || null,
      champion_team_id: champion,
      runner_up_team_id: runnerUp,
      organizer_id: draft.organizerId || null,
      format: draft.format || null,
      group_count: draft.groupCount || null,
    };
    if (tid) {
      const { error } = await supabase.from("tournaments").update(row).eq("id", tid);
      if (error) return finish(error.message);
    } else {
      const { data, error } = await supabase.from("tournaments").insert(row).select("id").single();
      if (error || !data) return finish(error?.message ?? "Erro ao criar torneio.");
      tid = data.id as string;
    }
    // sincroniza os times preservando seed/group_label de um sorteio anterior
    const { data: existing } = await supabase
      .from("tournament_teams")
      .select("team_id, seed, group_label")
      .eq("tournament_id", tid);
    const prev = new Map(
      ((existing as { team_id: string; seed: number | null; group_label: string | null }[]) ?? []).map(
        (x) => [x.team_id, x],
      ),
    );
    await supabase.from("tournament_teams").delete().eq("tournament_id", tid);
    if (draft.teamIds.length)
      await supabase.from("tournament_teams").insert(
        draft.teamIds.map((team_id) => ({
          tournament_id: tid,
          team_id,
          seed: prev.get(team_id)?.seed ?? null,
          group_label: (teamGroups[team_id] ?? prev.get(team_id)?.group_label) || null,
        })),
      );
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
      // elegíveis = elenco global do time + elenco salvo desta copa (época pode ter
      // jogadores que não estão no elenco global do time).
      const ids = [
        ...(rosters[teamId] ?? []).map((x) => x.playerId),
        ...(teamSquads[teamId] ?? []).map((x) => x.playerId),
      ];
      for (const pid of ids) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        out.push({ id: pid, name: playerName(pid), teamId });
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  // posição padrão de um jogador num time: a do elenco, senão a natural.
  function defaultPos(teamId: string | null, pid: string): Position | null {
    if (teamId) {
      const r = (rosters[teamId] ?? []).find((x) => x.playerId === pid);
      if (r?.position) return r.position;
    }
    return playerPos[pid] ?? null;
  }

  const lineupOf = (pid: string) => newMatch.lineups.find((l) => l.playerId === pid);

  // marca/desmarca um jogador como escalado (titular) num time.
  function toggleLineup(pid: string, teamId: string | null) {
    setNewMatch((m) => {
      const exists = m.lineups.some((l) => l.playerId === pid);
      if (exists) return { ...m, lineups: m.lineups.filter((l) => l.playerId !== pid) };
      const entry: MatchLineup = {
        playerId: pid,
        teamId,
        position: defaultPos(teamId, pid),
        isStarter: true,
        rating: null,
      };
      return { ...m, lineups: [...m.lineups, entry] };
    });
  }

  function setLineupPos(pid: string, position: Position | null) {
    setNewMatch((m) => ({
      ...m,
      lineups: m.lineups.map((l) => (l.playerId === pid ? { ...l, position } : l)),
    }));
  }

  function setRating(pid: string, rating: Grade | null) {
    setNewMatch((m) => ({
      ...m,
      lineups: m.lineups.map((l) => (l.playerId === pid ? { ...l, rating } : l)),
    }));
  }

  function addEvent() {
    // substituição: dois jogadores (sai/entra); quem entra herda a posição
    if (evType === "substitution") {
      if (!evOut || !evIn || evOut === evIn) return;
      const out = newMatch.lineups.find((l) => l.playerId === evOut);
      const teamId = out?.teamId ?? eligiblePlayers().find((p) => p.id === evOut)?.teamId ?? null;
      const minute = evMinute.trim() === "" ? null : Number(evMinute) || 0;
      setNewMatch((m) => {
        const lineups = m.lineups.some((l) => l.playerId === evIn)
          ? m.lineups
          : [
              ...m.lineups,
              {
                playerId: evIn,
                teamId,
                position: out?.position ?? defaultPos(teamId, evIn),
                isStarter: false,
                rating: null,
              } as MatchLineup,
            ];
        return {
          ...m,
          lineups,
          events: [
            ...m.events,
            { playerId: evIn, teamId, type: "substitution" as MatchEventType, minute, outPlayerId: evOut },
          ],
        };
      });
      setEvOut("");
      setEvIn("");
      setEvMinute("");
      return;
    }
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

  // disputa de pênaltis: adiciona uma cobrança (convertida ou perdida).
  function addShootout(scored: boolean) {
    if (!penPlayer) return;
    const teamId = eligiblePlayers().find((p) => p.id === penPlayer)?.teamId ?? null;
    setNewMatch((m) => ({
      ...m,
      events: [
        ...m.events,
        { playerId: penPlayer, teamId, type: scored ? "shootout_goal" : "shootout_miss", minute: null },
      ],
    }));
  }

  function editMatch(m: Match) {
    setEditingMatchId(m.id ?? null);
    setNewMatch({ ...m });
    setLiveMode(m.isLive);
    setScheduledMode(m.scheduled);
    setWoTeam(
      m.wo
        ? m.homeScore === m.awayScore
          ? WO_BOTH
          : m.homeScore > m.awayScore
            ? m.homeTeamId
            : m.awayTeamId
        : null,
    );
    setEditorOpen(true);
    setEvPlayer("");
    setEvType("goal");
    setEvMinute("");
    setEvOut("");
    setEvIn("");
    setErr("");
    setMsg("");
  }

  // endLive: força o fim da partida (vira súmula) e mantém o editor aberto p/ MVP
  async function saveMatch(opts?: { endLive?: boolean }) {
    if (!draft?.id) return;
    setBusy(true);
    setErr("");
    const scheduled = scheduledMode;
    const isWO = !!woTeam && !scheduled;
    const isLive = opts?.endLive || scheduled || isWO ? false : newMatch.isLive;
    // Validações: ambos os times sempre; escalação só quando NÃO é agendada nem W.O.
    if (!scheduled) {
      if (!newMatch.homeTeamId || !newMatch.awayTeamId)
        return finish("Selecione os dois times antes de salvar.");
      if (!isWO) {
        const homeN = newMatch.lineups.filter((l) => l.teamId === newMatch.homeTeamId).length;
        const awayN = newMatch.lineups.filter((l) => l.teamId === newMatch.awayTeamId).length;
        if (homeN === 0 || awayN === 0)
          return finish("Escale ao menos um jogador de cada time antes de salvar.");
      }
    }
    // MVP só vale para partida encerrada (não ao vivo / não agendada / não W.O.)
    const mvp = isLive || scheduled || isWO ? null : newMatch.mvpPlayerId;
    // placar: W.O. = 3×0 para o beneficiado; senão automático pelos eventos.
    const score = isWO
      ? {
          home: woTeam === newMatch.homeTeamId ? 3 : 0,
          away: woTeam === newMatch.awayTeamId ? 3 : 0,
        }
      : matchScore(newMatch.events, newMatch.homeTeamId, newMatch.awayTeamId);
    const row = {
      tournament_id: draft.id,
      home_team_id: newMatch.homeTeamId,
      away_team_id: newMatch.awayTeamId,
      home_score: score.home,
      away_score: score.away,
      is_live: isLive,
      scheduled,
      wo: isWO,
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

    // sincroniza eventos (apaga e regrava). W.O. não tem eventos.
    await supabase.from("match_events").delete().eq("match_id", matchId);
    if (!isWO && newMatch.events.length) {
      const { error: ee } = await supabase.from("match_events").insert(
        newMatch.events.map((e) => ({
          match_id: matchId,
          player_id: e.playerId,
          team_id: e.teamId,
          type: e.type,
          minute: e.minute,
          secondary_player_id: e.outPlayerId ?? null,
        })),
      );
      if (ee) return finish(ee.message);
    }

    // sincroniza a escalação + notas (apaga e regrava). W.O. não tem escalação.
    await supabase.from("match_lineups").delete().eq("match_id", matchId);
    if (!isWO && newMatch.lineups.length) {
      const { error: le } = await supabase.from("match_lineups").insert(
        newMatch.lineups.map((l) => ({
          match_id: matchId,
          player_id: l.playerId,
          team_id: l.teamId,
          position: l.position,
          is_starter: l.isStarter,
          rating: l.rating,
        })),
      );
      if (le) return finish(le.message);
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

  // Gera partidas agendadas a partir do formato + sorteio (funções puras).
  async function generateFixtures() {
    if (!draft?.id || !draft.format) return;
    if (draft.teamIds.length < 2) return setErr("Vincule ao menos 2 times ao campeonato.");
    if (
      !confirm(
        "Gerar as partidas deste formato? As partidas agendadas atuais serão substituídas (resultados já lançados são mantidos).",
      )
    )
      return;
    setBusy(true);
    setErr("");
    setMsg("");

    // lê o sorteio (ordem/grupos); sem sorteio usa a ordem dos vínculos
    const { data: tt } = await supabase
      .from("tournament_teams")
      .select("team_id, seed, group_label")
      .eq("tournament_id", draft.id);
    const rows =
      (tt as { team_id: string; seed: number | null; group_label: string | null }[]) ?? [];
    const ordered = [...rows].sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999));
    const ids = ordered.length ? ordered.map((r) => r.team_id) : draft.teamIds;
    const groupOf = new Map(rows.map((r) => [r.team_id, r.group_label]));

    const pairs: { home: string; away: string }[] = [];
    const add = (ps: Pairing[]) =>
      ps.forEach((p) => {
        if (p.home !== BYE && p.away !== BYE) pairs.push({ home: p.home, away: p.away });
      });

    if (draft.format === "pontos_corridos") {
      generateRoundRobin(ids).forEach((r) => add(r.pairings));
    } else if (draft.format === "grupos_mata_mata" || draft.format === "libertadores") {
      const labeled = ids.filter((id) => groupOf.get(id));
      let groups: { teamIds: string[] }[];
      if (labeled.length) {
        const map = new Map<string, string[]>();
        for (const id of ids) {
          const key = groupOf.get(id) ?? "Grupo A";
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(id);
        }
        groups = [...map.values()].map((teamIds) => ({ teamIds }));
      } else {
        groups = splitGroups(ids, draft.groupCount ?? undefined);
      }
      groups.forEach((g) => generateRoundRobin(g.teamIds).forEach((r) => add(r.pairings)));
    } else if (draft.format === "mata_mata") {
      const rounds = buildKnockout(ids, []);
      rounds[0]?.matches.forEach((m) => {
        if (m.home && m.away && m.home !== BYE && m.away !== BYE)
          pairs.push({ home: m.home, away: m.away });
      });
    } else if (draft.format === "suico") {
      // próxima rodada conforme os resultados atuais (não repete confrontos)
      add(generateSwissPairs(computeSwissRecords(ids, matches), playedPairs(matches)));
    }

    // evita duplicatas: pula confrontos já jogados e repetidos no próprio lote
    const done = playedPairs(matches);
    const seen = new Set<string>();
    const fresh = pairs.filter((p) => {
      const k = pairKey(p.home, p.away);
      if (done.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // remove as partidas agendadas anteriores (não duplica a cada clique)
    await supabase.from("matches").delete().eq("tournament_id", draft.id).eq("scheduled", true);

    if (fresh.length === 0) {
      setBusy(false);
      await loadSub(draft.id);
      return setMsg("Nenhuma partida nova a gerar (todas já foram jogadas).");
    }

    const { error } = await supabase.from("matches").insert(
      fresh.map((p) => ({
        tournament_id: draft.id,
        home_team_id: p.home,
        away_team_id: p.away,
        scheduled: true,
      })),
    );
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg(`${fresh.length} partida(s) gerada(s) em "Próximas partidas".`);
    await loadSub(draft.id);
  }

  // Salva o resultado de um confronto suíço. Se já existe a partida (sorteada/
  // agendada), atualiza-a; senão cria finalizada. Recalcula a classificação.
  async function saveSwissResult(
    home: string,
    away: string,
    hs: number,
    as: number,
    matchId?: string,
  ) {
    if (!draft?.id) return;
    setBusy(true);
    setErr("");
    setMsg("");
    let error;
    if (matchId) {
      ({ error } = await supabase
        .from("matches")
        .update({ home_score: hs, away_score: as, scheduled: false, is_live: false })
        .eq("id", matchId));
    } else {
      ({ error } = await supabase.from("matches").insert({
        tournament_id: draft.id,
        home_team_id: home,
        away_team_id: away,
        home_score: hs,
        away_score: as,
        scheduled: false,
        is_live: false,
      }));
    }
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg("Resultado computado — classificação atualizada.");
    await loadSub(draft.id);
  }

  // Sorteia uma rodada do suíço: grava os confrontos como partidas agendadas.
  async function scheduleSwissRound(pairs: { home: string; away: string }[]) {
    if (!draft?.id || pairs.length === 0) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const { error } = await supabase.from("matches").insert(
      pairs.map((p) => ({
        tournament_id: draft.id,
        home_team_id: p.home,
        away_team_id: p.away,
        scheduled: true,
      })),
    );
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg(`🎲 Rodada sorteada — ${pairs.length} confronto(s) gerado(s).`);
    await loadSub(draft.id);
  }

  // Sorteio: embaralha os times e grava seed + grupo (chaveamento/grupos).
  async function drawTeams() {
    if (!draft?.id) return;
    const ids = [...draft.teamIds];
    if (ids.length < 2) return setErr("Vincule ao menos 2 times ao campeonato.");
    if (!confirm("Realizar o sorteio? Isso define a ordem/grupos do chaveamento."))
      return;
    // Fisher-Yates
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const isGroups = draft.format === "grupos_mata_mata" || draft.format === "libertadores";
    const gc = isGroups ? Math.max(2, draft.groupCount || suggestGroupCount(ids.length)) : 0;

    setBusy(true);
    setErr("");
    setMsg("");
    await supabase.from("tournament_teams").delete().eq("tournament_id", draft.id);
    const { error } = await supabase.from("tournament_teams").insert(
      ids.map((team_id, i) => ({
        tournament_id: draft.id,
        team_id,
        seed: i + 1,
        group_label: isGroups ? `Grupo ${String.fromCharCode(65 + (i % gc))}` : null,
      })),
    );
    setBusy(false);
    if (error) return setErr(error.message);
    // reflete o sorteio no editor manual de grupos (sem precisar recarregar)
    const assigned: Record<string, string> = {};
    if (isGroups)
      ids.forEach((team_id, i) => {
        assigned[team_id] = `Grupo ${String.fromCharCode(65 + (i % gc))}`;
      });
    setTeamGroups(assigned);
    setMsg("🎲 Sorteio realizado! Ordem e grupos definidos.");
    await loadLists();
  }

  // Salva só a atribuição manual de grupos (preserva o seed do sorteio anterior).
  async function saveGroups() {
    if (!draft?.id) return;
    if (!draft.teamIds.length) return setErr("Vincule ao menos 1 time ao campeonato.");
    setBusy(true);
    setErr("");
    setMsg("");
    const tid = draft.id;
    const { data: existing } = await supabase
      .from("tournament_teams")
      .select("team_id, seed, group_label")
      .eq("tournament_id", tid);
    const prev = new Map(
      ((existing as { team_id: string; seed: number | null; group_label: string | null }[]) ?? []).map(
        (x) => [x.team_id, x],
      ),
    );
    await supabase.from("tournament_teams").delete().eq("tournament_id", tid);
    const { error } = await supabase.from("tournament_teams").insert(
      draft.teamIds.map((team_id) => ({
        tournament_id: tid,
        team_id,
        seed: prev.get(team_id)?.seed ?? null,
        group_label: (teamGroups[team_id] ?? prev.get(team_id)?.group_label) || null,
      })),
    );
    setBusy(false);
    if (error) return setErr(error.message);
    setMsg("Grupos salvos.");
    await loadSub(tid);
  }

  // Salva os jogadores campeões/vices desta copa (subconjunto do elenco vencedor).
  async function saveWinnerPlayers() {
    if (!draft?.id) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const tid = draft.id;
    // um jogador não pode ser campeão e vice na mesma copa (PK = tournament_id+player_id)
    const champSet = new Set(championPlayers);
    const vice = runnerUpPlayers.filter((id) => !champSet.has(id));
    await supabase.from("tournament_winner_players").delete().eq("tournament_id", tid);
    const rows = [
      ...championPlayers.map((player_id) => ({ tournament_id: tid, player_id, kind: "champion" })),
      ...vice.map((player_id) => ({ tournament_id: tid, player_id, kind: "runner_up" })),
    ];
    if (rows.length) {
      const { error } = await supabase.from("tournament_winner_players").insert(rows);
      if (error) {
        setBusy(false);
        return setErr(error.message);
      }
    }
    setBusy(false);
    setMsg("Campeões/vices da copa salvos.");
  }

  // pódio: define/limpa um prêmio no estado local
  function setAward(key: string, playerId: string) {
    setAwards((a) => {
      const n = { ...a };
      if (playerId) n[key] = playerId;
      else delete n[key];
      return n;
    });
  }

  // pódio: regrava todos os prêmios da copa (apaga e insere os preenchidos)
  async function saveAwards() {
    if (!draft?.id) return;
    setBusy(true);
    setErr("");
    setMsg("");
    const tid = draft.id;
    await supabase.from("tournament_awards").delete().eq("tournament_id", tid);
    const rows = Object.entries(awards)
      .filter(([, pid]) => pid)
      .map(([award_key, player_id]) => ({ tournament_id: tid, award_key, player_id }));
    if (rows.length) {
      const { error } = await supabase.from("tournament_awards").insert(rows);
      if (error) {
        setBusy(false);
        return setErr(error.message);
      }
    }
    setBusy(false);
    setMsg("Pódio salvo.");
    await loadSub(tid);
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
  // placar automático do rascunho (gols + gol contra ao adversário)
  const draftScore = matchScore(newMatch.events, newMatch.homeTeamId, newMatch.awayTeamId);
  const draftScoreA = draftScore.home;
  const draftScoreB = draftScore.away;

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
            {teamName(m.homeTeamId)}{" "}
            {m.scheduled ? "vs" : `${m.homeScore} × ${m.awayScore}`} {teamName(m.awayTeamId)}
          </span>
          {m.isLive && (
            <span className="ml-2 rounded bg-loss px-1.5 py-0.5 text-[10px] font-bold text-white">
              AO VIVO
            </span>
          )}
          {m.scheduled && (
            <span className="ml-2 rounded bg-draw/20 px-1.5 py-0.5 text-[10px] font-bold text-draw">
              AGENDADA
            </span>
          )}
          <span className="ml-2 text-xs text-faint">{m.playedAt ?? ""}</span>
          {m.events.length > 0 && (
            <div className="text-[10px] text-faint">
              {m.events
                .map(
                  (e) =>
                    `${eventEmoji(e.type)} ${playerName(e.playerId)}${
                      e.type === "substitution" && e.outPlayerId
                        ? ` ← ${playerName(e.outPlayerId)}`
                        : ""
                    }${e.minute != null ? ` ${e.minute}'` : ""}`,
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
    // escalação obrigatória para súmula/partida ao vivo (não em agendadas)
    const homeLineupN = newMatch.lineups.filter((l) => l.teamId === newMatch.homeTeamId).length;
    const awayLineupN = newMatch.lineups.filter((l) => l.teamId === newMatch.awayTeamId).length;
    // W.O. não exige escalação (a partida não aconteceu).
    const lineupMissing =
      !scheduledMode && !woTeam && bothTeams && (homeLineupN === 0 || awayLineupN === 0);
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
        {/* W.O. — time não compareceu (vence 3×0, sem escalação/eventos) */}
        {bothTeams && (
          <div className="flex flex-col gap-2 rounded-md border border-loss/30 bg-loss/5 p-2">
            <label className="flex flex-col gap-1 text-[11px]">
              <span className="font-bold uppercase tracking-wide text-faint">
                W.O. — time não compareceu
              </span>
              <select
                className={inputC}
                value={woTeam ?? ""}
                onChange={(e) => setWoTeam(e.target.value || null)}
              >
                <option value="">Não é W.O.</option>
                {newMatch.homeTeamId && (
                  <option value={newMatch.homeTeamId}>
                    {teamName(newMatch.homeTeamId)} vence por W.O.
                  </option>
                )}
                {newMatch.awayTeamId && (
                  <option value={newMatch.awayTeamId}>
                    {teamName(newMatch.awayTeamId)} vence por W.O.
                  </option>
                )}
                <option value={WO_BOTH}>Ambos não compareceram (0×0)</option>
              </select>
            </label>
            {woTeam && (
              <span className="text-[10px] text-loss">
                {woTeam === WO_BOTH ? (
                  <>Será salvo como W.O. duplo: <b>0×0</b> (empate) — escalação e eventos ignorados.</>
                ) : (
                  <>
                    Será salvo como W.O.: <b>{teamName(woTeam)}</b> vence 3×0 — escalação e eventos
                    ignorados.
                  </>
                )}
              </span>
            )}
          </div>
        )}
        {/* escalação: quem jogou e em qual posição (só esses aparecem na súmula) */}
        <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-gradient-to-b from-panel to-base/30 p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gold/15 text-sm">
              🧩
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wide">Escalação</span>
            <span className="text-[10px] text-faint">toque para escalar quem entrou em campo</span>
          </div>
          {!bothTeams ? (
            <span className="text-[11px] text-faint">
              Selecione os dois times para montar a escalação.
            </span>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {[newMatch.homeTeamId, newMatch.awayTeamId].map((tid) => {
                const list = [...(rosters[tid ?? ""] ?? [])].sort((a, b) =>
                  playerName(a.playerId).localeCompare(playerName(b.playerId)),
                );
                const count = newMatch.lineups.filter((l) => l.teamId === tid).length;
                return (
                  <div key={tid} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-lg bg-base/60 px-2.5 py-1.5">
                      <span className="truncate text-xs font-bold">{teamName(tid)}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          count ? "bg-gold/20 text-gold" : "bg-white/5 text-faint"
                        }`}
                      >
                        {count} em campo
                      </span>
                    </div>
                    {list.length === 0 && (
                      <span className="text-[10px] text-faint">Sem elenco cadastrado.</span>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                      {list.map((r) => {
                        const entry = lineupOf(r.playerId);
                        const selected = !!entry;
                        return (
                          <div
                            key={r.playerId}
                            className={`relative flex flex-col items-center gap-1 rounded-lg border p-1.5 transition ${
                              selected
                                ? "border-gold/60 bg-gold/10"
                                : "border-white/5 bg-base/40 opacity-60 hover:border-white/15 hover:opacity-100"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleLineup(r.playerId, tid)}
                              title={selected ? "Remover da escalação" : "Escalar"}
                              className="flex w-full flex-col items-center gap-0.5"
                            >
                              {selected && (
                                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[9px] font-black text-[#1a1a1e]">
                                  ✓
                                </span>
                              )}
                              {selected && entry && !entry.isStarter && (
                                <span
                                  title="Entrou por substituição"
                                  className="absolute left-1 top-1 text-[10px]"
                                >
                                  🔺
                                </span>
                              )}
                              <span className="flex h-12 w-11 items-end justify-center overflow-hidden rounded-md bg-base">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={avatarUrl(playerNick[r.playerId] || playerName(r.playerId))}
                                  alt=""
                                  className="object-contain"
                                  style={{ width: 44, height: 56 }}
                                />
                              </span>
                              <span className="w-full truncate text-center text-[10px] font-semibold leading-tight">
                                {playerName(r.playerId)}
                              </span>
                            </button>
                            {selected && (
                              <div className="flex flex-wrap justify-center gap-0.5">
                                {POSITIONS.map((p) => {
                                  const active = entry?.position === p.key;
                                  return (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() =>
                                        setLineupPos(r.playerId, active ? null : p.key)
                                      }
                                      className={`rounded px-1 py-0.5 text-[8px] font-bold transition ${
                                        active
                                          ? "bg-gold text-[#1a1a1e]"
                                          : "bg-base text-faint hover:text-white"
                                      }`}
                                    >
                                      {p.sigla}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* eventos (gols, pênaltis, assistências, cartões, substituições) */}
        <div className="flex flex-col gap-2 rounded-md bg-panel p-2">
          {!bothTeams ? (
            <span className="text-[11px] text-faint">
              Selecione os dois times para registrar os eventos dos jogadores.
            </span>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-[11px]">
                  Evento
                  <select
                    className={inputC}
                    value={evType}
                    onChange={(e) => setEvType(e.target.value as MatchEventType)}
                  >
                    {MATCH_EVENT_TYPES.filter(
                      (t) => t.type !== "shootout_goal" && t.type !== "shootout_miss",
                    ).map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.emoji} {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                {evType === "substitution" ? (
                  <>
                    <label className="flex flex-col gap-1 text-[11px]">
                      Sai 🔻
                      <select
                        className={inputC}
                        value={evOut}
                        onChange={(e) => {
                          setEvOut(e.target.value);
                          setEvIn("");
                        }}
                      >
                        <option value="">Selecione…</option>
                        {[newMatch.homeTeamId, newMatch.awayTeamId].map((tid) => (
                          <optgroup key={tid} label={teamName(tid)}>
                            {newMatch.lineups
                              .filter((l) => l.teamId === tid)
                              .map((l) => (
                                <option key={l.playerId} value={l.playerId}>
                                  {playerName(l.playerId)}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[11px]">
                      Entra 🔺
                      <select
                        className={inputC}
                        value={evIn}
                        disabled={!evOut}
                        onChange={(e) => setEvIn(e.target.value)}
                      >
                        <option value="">Selecione…</option>
                        {(() => {
                          const outTeam =
                            newMatch.lineups.find((l) => l.playerId === evOut)?.teamId ?? null;
                          return (rosters[outTeam ?? ""] ?? [])
                            .filter((r) => !newMatch.lineups.some((l) => l.playerId === r.playerId))
                            .sort((a, b) =>
                              playerName(a.playerId).localeCompare(playerName(b.playerId)),
                            )
                            .map((r) => (
                              <option key={r.playerId} value={r.playerId}>
                                {playerName(r.playerId)}
                              </option>
                            ));
                        })()}
                      </select>
                    </label>
                  </>
                ) : (
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
                )}
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
              {newMatch.events.some(
                (e) => e.type !== "shootout_goal" && e.type !== "shootout_miss",
              ) && (
                <div className="flex flex-wrap gap-1.5">
                  {newMatch.events.map((e, i) =>
                    e.type === "shootout_goal" || e.type === "shootout_miss" ? null : (
                      <button
                        key={i}
                        onClick={() => removeEvent(i)}
                        title="Remover evento"
                        className="rounded-md bg-base px-2 py-0.5 text-[11px]"
                      >
                        {eventEmoji(e.type)} {playerName(e.playerId)}
                        {e.type === "substitution" && e.outPlayerId
                          ? ` ← ${playerName(e.outPlayerId)}`
                          : ""}
                        {e.minute != null ? ` ${e.minute}'` : ""} ✕
                      </button>
                    ),
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* DECISÃO POR PÊNALTIS (mata-mata empatado) */}
        {bothTeams && (
          <div className="flex flex-col gap-2 rounded-md bg-panel p-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-faint">
              Decisão por pênaltis
              {(() => {
                const hg = newMatch.events.filter(
                  (e) => e.type === "shootout_goal" && e.teamId === newMatch.homeTeamId,
                ).length;
                const ag = newMatch.events.filter(
                  (e) => e.type === "shootout_goal" && e.teamId === newMatch.awayTeamId,
                ).length;
                const any = newMatch.events.some(
                  (e) => e.type === "shootout_goal" || e.type === "shootout_miss",
                );
                return any ? (
                  <span className="ml-2 font-mono text-white">
                    {hg} × {ag}
                  </span>
                ) : null;
              })()}
            </span>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-[11px]">
                Cobrador
                <select
                  className={inputC}
                  value={penPlayer}
                  onChange={(e) => setPenPlayer(e.target.value)}
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
              <button
                onClick={() => addShootout(true)}
                className="rounded-md bg-base px-3 py-2 text-xs hover:bg-base/70"
              >
                ⚽ Converteu
              </button>
              <button
                onClick={() => addShootout(false)}
                className="rounded-md bg-base px-3 py-2 text-xs hover:bg-base/70"
              >
                🔴 Errou
              </button>
            </div>
            {newMatch.events.some(
              (e) => e.type === "shootout_goal" || e.type === "shootout_miss",
            ) && (
              <div className="flex flex-wrap gap-1.5">
                {newMatch.events.map((e, i) =>
                  e.type === "shootout_goal" || e.type === "shootout_miss" ? (
                    <button
                      key={i}
                      onClick={() => removeEvent(i)}
                      title="Remover cobrança"
                      className="rounded-md bg-base px-2 py-0.5 text-[11px]"
                    >
                      {e.type === "shootout_goal" ? "⚽" : "🔴✕"} {playerName(e.playerId)} ✕
                    </button>
                  ) : null,
                )}
              </div>
            )}
            <span className="text-[10px] text-faint">
              Use quando o mata-mata terminar empatado. Não conta no placar nem na artilharia.
            </span>
          </div>
        )}

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

        {/* notas dos jogadores (só em súmula encerrada) */}
        {!liveMode && (
          <div className="flex flex-col gap-2 rounded-md bg-panel p-2">
            <span className="text-[11px] font-semibold">📝 Notas dos jogadores (C · B · A · A+ · S · S+)</span>
            {newMatch.lineups.length === 0 ? (
              <span className="text-[11px] text-faint">
                Escale os jogadores na seção acima para lançar notas.
              </span>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[newMatch.homeTeamId, newMatch.awayTeamId].map((tid) => (
                  <div key={tid} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-bold text-faint">{teamName(tid)}</span>
                    {newMatch.lineups
                      .filter((l) => l.teamId === tid)
                      .sort((a, b) => playerName(a.playerId).localeCompare(playerName(b.playerId)))
                      .map((l) => (
                        <div key={l.playerId} className="flex items-center gap-2 text-[11px]">
                          <span className="flex-1 truncate">
                            {playerName(l.playerId)}
                            {!l.isStarter && <span className="text-draw"> ↑</span>}
                          </span>
                          <select
                            value={l.rating ?? ""}
                            onChange={(e) =>
                              setRating(l.playerId, (e.target.value || null) as Grade | null)
                            }
                            className={`${inputC} w-24 shrink-0 py-1 text-center font-extrabold ${
                              l.rating ? gradeClass(l.rating) : ""
                            }`}
                          >
                            <option value="">— nota —</option>
                            {GRADES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
          </>
        )}

        {/* aviso: escalação obrigatória para novas súmulas/partidas ao vivo */}
        {lineupMissing && (
          <p className="rounded-md bg-loss/10 px-2 py-1.5 text-[11px] font-semibold text-loss">
            ⚠ Escale ao menos um jogador de cada time na seção 🧩 Escalação antes de salvar.
          </p>
        )}

        {/* ações */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => saveMatch()}
            disabled={busy || lineupMissing}
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
                      style={focusStyle(t.imageUrl)}
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

                {/* FORMATO DO CAMPEONATO + SORTEIO */}
                <div className="flex flex-col gap-2 rounded-md bg-panel/40 p-3">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="font-bold">🏗 Formato do campeonato</span>
                    <select
                      className={inputC}
                      value={draft.format ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          format: (e.target.value || null) as TournamentFormat | null,
                        })
                      }
                    >
                      <option value="">— Não definido —</option>
                      {TOURNAMENT_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label} — {f.desc}
                        </option>
                      ))}
                    </select>
                  </label>

                  <span className="text-[11px] text-faint">
                    {draft.teamIds.length} time(s) vinculado(s).
                  </span>

                  {/* nº de grupos (grupos + mata-mata, incl. Libertadores) */}
                  {(draft.format === "grupos_mata_mata" || draft.format === "libertadores") && (
                    <label className="flex w-40 flex-col gap-1 text-xs">
                      Número de grupos
                      <input
                        type="number"
                        min={2}
                        placeholder={`${suggestGroupCount(draft.teamIds.length)}`}
                        className={inputC}
                        value={draft.groupCount ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, groupCount: Number(e.target.value) || null })
                        }
                      />
                    </label>
                  )}

                  {/* atribuição MANUAL de grupos (a dedo) — sobrepõe o sorteio */}
                  {(draft.format === "grupos_mata_mata" || draft.format === "libertadores") &&
                    draft.teamIds.length > 0 &&
                    (() => {
                      const count = Math.max(
                        2,
                        draft.groupCount || suggestGroupCount(draft.teamIds.length),
                      );
                      const base = Array.from(
                        { length: count },
                        (_, i) => `Grupo ${String.fromCharCode(65 + i)}`,
                      );
                      // preserva rótulos já existentes fora do padrão (ex.: "Grupo 1")
                      const extra = [...new Set(Object.values(teamGroups))].filter(
                        (l) => l && !base.includes(l),
                      );
                      const labels = [...base, ...extra];
                      return (
                        <div className="flex flex-col gap-2 rounded-md bg-panel/30 p-2">
                          <span className="text-xs font-bold">Grupos (a dedo)</span>
                          <div className="grid gap-1 sm:grid-cols-2">
                            {[...draft.teamIds]
                              .sort(
                                (a, b) =>
                                  (teamGroups[a] ?? "").localeCompare(teamGroups[b] ?? "") ||
                                  teamName(a).localeCompare(teamName(b)),
                              )
                              .map((id) => (
                                <label
                                  key={id}
                                  className="flex items-center justify-between gap-2 rounded bg-card px-2 py-1 text-xs"
                                >
                                  <span className="truncate">{teamName(id)}</span>
                                  <select
                                    className="shrink-0 rounded bg-panel px-1 py-0.5 text-xs"
                                    value={teamGroups[id] ?? ""}
                                    onChange={(e) =>
                                      setTeamGroups((g) => ({ ...g, [id]: e.target.value }))
                                    }
                                  >
                                    <option value="">—</option>
                                    {labels.map((lbl) => (
                                      <option key={lbl} value={lbl}>
                                        {lbl}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ))}
                          </div>
                          <button
                            type="button"
                            onClick={saveGroups}
                            disabled={busy || !draft.id}
                            className="self-start rounded-md bg-win px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                          >
                            💾 Salvar grupos
                          </button>
                          <span className="text-[11px] text-faint">
                            Cada time vai para o grupo escolhido (sobrepõe o sorteio). Depois clique
                            em <b>Gerar partidas</b>.
                          </span>
                        </div>
                      );
                    })()}

                  {draft.id && draft.format && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={drawTeams}
                        disabled={busy}
                        className="rounded-md bg-gold px-3 py-1.5 text-xs font-bold text-[#1a1a1e] hover:opacity-90 disabled:opacity-60"
                      >
                        🎲 Sortear chaveamento
                      </button>
                      <button
                        type="button"
                        onClick={generateFixtures}
                        disabled={busy}
                        className="rounded-md bg-draw px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        ⚙ Gerar partidas
                      </button>
                    </div>
                  )}
                  {draft.id && draft.format && (
                    <span className="text-[11px] text-faint">
                      Dica: defina o formato e os times, clique em <b>Sortear</b> e depois em{" "}
                      <b>Gerar partidas</b>.
                    </span>
                  )}
                </div>

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

                {/* VICE-CAMPEÃO */}
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-bold">🥈 Time vice-campeão</span>
                  {draft.teamIds.length === 0 ? (
                    <span className="text-faint">
                      Adicione times participantes para definir o vice.
                    </span>
                  ) : (
                    <select
                      className={inputC}
                      value={draft.runnerUpTeamId ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, runnerUpTeamId: e.target.value || null })
                      }
                    >
                      <option value="">— Sem vice / não definido —</option>
                      {allTeams
                        .filter((t) => draft.teamIds.includes(t.id) && t.id !== draft.championTeamId)
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

                  {/* SISTEMA SUÍÇO — classificação + confrontos interativos */}
                  {draft.format === "suico" && (
                    <div className="rounded-lg bg-card p-4">
                      <h3 className="mb-3 text-sm font-bold">
                        Sistema Suíço — classificação e confrontos
                      </h3>
                      <SwissAdminPanel
                        teams={matchTeams}
                        matches={matches}
                        busy={busy}
                        onSaveResult={saveSwissResult}
                        onScheduleRound={scheduleSwissRound}
                      />
                    </div>
                  )}

                  {/* PÓDIO / PRÊMIOS */}
                  <div className="rounded-lg bg-card p-4">
                    <h3 className="mb-1 text-sm font-bold">🏆 Pódio / Prêmios</h3>
                    <p className="mb-3 text-[11px] text-faint">
                      Top 1/2/3 por posição + especiais (opcionais). Vazio = aparece como “Em breve”
                      na página da copa.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {POSITIONS.map((pos) => (
                        <div key={pos.key} className="rounded-md bg-panel p-2">
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-faint">
                            {pos.label}
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {[1, 2, 3].map((place) => (
                              <label key={place} className="flex items-center gap-2 text-[11px]">
                                <span className="w-5 shrink-0 font-bold">{place}º</span>
                                <select
                                  className={inputC}
                                  value={awards[`${pos.key}_${place}`] ?? ""}
                                  onChange={(e) => setAward(`${pos.key}_${place}`, e.target.value)}
                                >
                                  <option value="">—</option>
                                  {allPlayers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {[
                        { k: "best_player", l: "Melhor da Copa" },
                        { k: "best_gk", l: "Melhor Goleiro" },
                        { k: "revelation", l: "Revelação" },
                      ].map((s) => (
                        <label key={s.k} className="flex flex-col gap-1 text-[11px]">
                          {s.l}
                          <select
                            className={inputC}
                            value={awards[s.k] ?? ""}
                            onChange={(e) => setAward(s.k, e.target.value)}
                          >
                            <option value="">—</option>
                            {allPlayers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={saveAwards}
                      disabled={busy}
                      className="mt-3 rounded-md bg-gold px-4 py-2 text-xs font-bold text-[#1a1a1e] transition-transform hover:scale-[1.02] disabled:opacity-50"
                    >
                      Salvar pódio
                    </button>
                  </div>

                  {/* ELENCO POR TIME: editado em Admin → Times (por campeonato) */}
                  {draft.teamIds.length > 0 && (
                    <div className="rounded-lg bg-card p-4">
                      <h3 className="mb-1 text-sm font-bold">👥 Elenco dos times</h3>
                      <p className="text-[11px] text-faint">
                        O elenco de cada time <b className="text-white">nesta copa</b> é editado em{" "}
                        <b className="text-white">Admin → Times</b>: abra o time e, no seletor{" "}
                        <b className="text-white">&quot;Editando o elenco de&quot;</b>, escolha este
                        campeonato. As mudanças valem só para esta copa. Aqui você cuida apenas da
                        configuração do torneio (times, grupos, partidas, pódio).
                      </p>
                    </div>
                  )}

                  {/* JOGADORES CAMPEÕES / VICE-CAMPEÕES DA COPA */}
                  {(draft.championTeamId || draft.runnerUpTeamId) && (
                    <div className="rounded-lg bg-card p-4">
                      <h3 className="mb-1 text-sm font-bold">🏅 Jogadores campeões / vice-campeões</h3>
                      <p className="mb-3 text-[11px] text-faint">
                        Marque quem realmente levantou a taça nesta edição (o elenco vencedor desta
                        copa). Assim não é preciso duplicar o time nem marcar todo o histórico do
                        elenco como campeão.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          {
                            teamId: draft.championTeamId,
                            title: "🏆 Campeões",
                            selected: championPlayers,
                            setSelected: setChampionPlayers,
                          },
                          {
                            teamId: draft.runnerUpTeamId,
                            title: "🥈 Vice-campeões",
                            selected: runnerUpPlayers,
                            setSelected: setRunnerUpPlayers,
                          },
                        ].map((col) => {
                          const roster = col.teamId ? rosters[col.teamId] ?? [] : [];
                          return (
                            <div key={col.title} className="flex flex-col gap-2 rounded-md bg-panel p-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[11px] font-bold uppercase tracking-wide text-faint">
                                  {col.title}
                                  {col.teamId && ` · ${teamName(col.teamId)}`}
                                </span>
                                {col.teamId && roster.length > 0 && (
                                  <span className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      onClick={() => col.setSelected(roster.map((m) => m.playerId))}
                                      className="rounded bg-base px-1.5 py-0.5 text-[10px] text-faint hover:text-white"
                                    >
                                      Todos
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => col.setSelected([])}
                                      className="rounded bg-base px-1.5 py-0.5 text-[10px] text-faint hover:text-white"
                                    >
                                      Limpar
                                    </button>
                                  </span>
                                )}
                              </div>
                              {!col.teamId ? (
                                <span className="text-[11px] text-faint">
                                  Defina o time {col.title.includes("Vice") ? "vice-campeão" : "campeão"} acima.
                                </span>
                              ) : roster.length === 0 ? (
                                <span className="text-[11px] text-faint">
                                  Sem elenco cadastrado para este time.
                                </span>
                              ) : (
                                <ul className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto">
                                  {roster.map((m) => {
                                    const on = col.selected.includes(m.playerId);
                                    return (
                                      <li key={m.playerId}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            col.setSelected(
                                              on
                                                ? col.selected.filter((x) => x !== m.playerId)
                                                : [...col.selected, m.playerId],
                                            )
                                          }
                                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-base ${
                                            on ? "text-gold" : ""
                                          }`}
                                        >
                                          <span className="truncate">{playerName(m.playerId)}</span>
                                          <span>{on ? "✓" : "+"}</span>
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              <span className="text-[10px] text-faint">
                                {col.selected.length} marcado(s)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={saveWinnerPlayers}
                        disabled={busy}
                        className="mt-3 rounded-md bg-gold px-4 py-2 text-xs font-bold text-[#1a1a1e] transition-transform hover:scale-[1.02] disabled:opacity-50"
                      >
                        Salvar campeões/vices
                      </button>
                    </div>
                  )}

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
