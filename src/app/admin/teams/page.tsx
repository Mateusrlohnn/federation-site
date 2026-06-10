"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/ui/Icon";
import ImageUpload from "@/components/ui/ImageUpload";
import { focusStyle } from "@/lib/imageFocus";
import {
  POSITIONS,
  asPosition,
  emptyTeam,
  teamFromRow,
  teamToRow,
  type Team,
  type Position,
  type RosterMember,
} from "@/lib/teams";

type PlayerLite = { id: string; name: string };

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  // teamId -> copas que o time disputa/disputou (id + nome + status)
  const [teamCups, setTeamCups] = useState<Record<string, { id: string; name: string; status: string }[]>>(
    {},
  );
  const [allPlayers, setAllPlayers] = useState<PlayerLite[]>([]);
  const [draft, setDraft] = useState<Team | null>(null);
  // escopo do elenco em edição: "" = elenco geral (team_players);
  // senão, id do campeonato (edita o elenco daquela copa em tournament_team_players)
  const [scope, setScope] = useState("");
  // cache dos elencos por copa já carregados nesta sessão: tournamentId -> elenco
  const [cupRosters, setCupRosters] = useState<Record<string, RosterMember[]>>({});
  const [q, setQ] = useState("");
  const [rosterQ, setRosterQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const supabase = createClient();

  const load = useCallback(async () => {
    const [t, p, tt] = await Promise.all([
      supabase
        .from("teams")
        .select("*, team_players(player_id, position, active)")
        .order("titles", { ascending: false }),
      supabase.from("players").select("id, name").order("name"),
      supabase.from("tournament_teams").select("team_id, tournaments(id, name, status, created_at)"),
    ]);
    if (!t.error && t.data) setTeams(t.data.map(teamFromRow));
    if (!p.error && p.data) setAllPlayers(p.data as PlayerLite[]);
    if (!tt.error && tt.data) {
      // ordena por copa mais recente; "Em andamento" antes das demais na exibição
      const rows = tt.data as unknown as {
        team_id: string;
        tournaments: { id: string; name: string; status: string; created_at: string } | null;
      }[];
      const map: Record<string, { id: string; name: string; status: string; createdAt: string }[]> = {};
      for (const r of rows) {
        if (!r.tournaments) continue;
        (map[r.team_id] ??= []).push({
          id: r.tournaments.id,
          name: r.tournaments.name,
          status: r.tournaments.status,
          createdAt: r.tournaments.created_at,
        });
      }
      const out: Record<string, { id: string; name: string; status: string }[]> = {};
      for (const [teamId, cups] of Object.entries(map)) {
        out[teamId] = cups
          .sort(
            (a, b) =>
              Number(b.status === "Em andamento") - Number(a.status === "Em andamento") ||
              (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
          )
          .map((c) => ({ id: c.id, name: c.name, status: c.status }));
      }
      setTeamCups(out);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    allPlayers.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [allPlayers]);

  // elenco atualmente em edição (geral ou da copa selecionada)
  const currentRoster: RosterMember[] = scope ? cupRosters[scope] ?? [] : draft?.roster ?? [];

  // aplica uma transformação no elenco do escopo atual (geral -> draft; copa -> cupRosters)
  function updateRoster(fn: (roster: RosterMember[]) => RosterMember[]) {
    if (scope) {
      setCupRosters((prev) => ({ ...prev, [scope]: fn(prev[scope] ?? []) }));
    } else if (draft) {
      setDraft({ ...draft, roster: fn(draft.roster) });
    }
  }

  function addPlayer(id: string) {
    updateRoster((r) =>
      r.some((m) => m.playerId === id) ? r : [...r, { playerId: id, position: null, active: true }],
    );
  }

  function removePlayer(id: string) {
    updateRoster((r) => r.filter((m) => m.playerId !== id));
  }

  function setPosition(id: string, position: Position | null) {
    updateRoster((r) => r.map((m) => (m.playerId === id ? { ...m, position } : m)));
  }

  function setActive(id: string, active: boolean) {
    updateRoster((r) => r.map((m) => (m.playerId === id ? { ...m, active } : m)));
  }

  // seleciona um time para edição (reseta o escopo para o elenco geral)
  function selectTeam(t: Team | null) {
    setDraft(t);
    setScope("");
    setCupRosters({});
    setRosterQ("");
    setErr("");
    setMsg("");
  }

  // troca o escopo do elenco; carrega o elenco da copa (uma vez) se ainda não estiver em cache
  async function changeScope(newScope: string) {
    setScope(newScope);
    setRosterQ("");
    if (newScope && draft?.id && !(newScope in cupRosters)) {
      const { data, error } = await supabase
        .from("tournament_team_players")
        .select("player_id, position")
        .eq("tournament_id", newScope)
        .eq("team_id", draft.id);
      if (!error)
        setCupRosters((prev) => ({
          ...prev,
          [newScope]: (data ?? []).map((r) => ({
            playerId: r.player_id as string,
            position: asPosition(r.position),
            active: true, // elenco de copa não usa ativo/ex
          })),
        }));
    }
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) return setErr("Informe o nome do time.");
    setBusy(true);
    setErr("");
    setMsg("");

    // garante que o time existe e salva os campos do time (nome/logo/dono/ON-OFF)
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

    if (scope) {
      // elenco de UMA copa: grava só em tournament_team_players. Não toca no elenco
      // geral nem nas outras copas — cada época do time é independente.
      const roster = cupRosters[scope] ?? [];
      await supabase
        .from("tournament_team_players")
        .delete()
        .eq("tournament_id", scope)
        .eq("team_id", teamId);
      if (roster.length) {
        const { error } = await supabase.from("tournament_team_players").insert(
          roster.map((m) => ({
            tournament_id: scope,
            team_id: teamId,
            player_id: m.playerId,
            position: m.position,
          })),
        );
        if (error) {
          setBusy(false);
          return setErr(error.message);
        }
      }
      setBusy(false);
      const cupName = (teamCups[teamId] ?? []).find((c) => c.id === scope)?.name ?? "campeonato";
      setMsg(`Elenco de "${draft.name}" no campeonato "${cupName}" salvo.`);
      await load(); // mantém o editor aberto no mesmo campeonato
      return;
    }

    // elenco GERAL (aba Times): sincroniza team_players — mantém posição e status ativo/ex
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
            onClick={() => selectTeam(emptyTeam())}
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
          {(() => {
            const onTeams = filteredTeams.filter((t) => t.active);
            const offTeams = filteredTeams.filter((t) => !t.active);
            const item = (t: Team, showCups = true) => (
              <li key={t.id ?? t.name}>
                <button
                  onClick={() => selectTeam({ ...t })}
                  className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel ${
                    draft?.id && draft.id === t.id ? "bg-panel ring-1 ring-gold" : ""
                  }`}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-base">
                    {t.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logoUrl} alt="" className="h-full w-full object-cover" style={focusStyle(t.logoUrl)} />
                    ) : (
                      <Icon name="shield" className="text-[10px] text-faint" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{t.name}</span>
                    {t.ownerId && nameById.get(t.ownerId) && (
                      <span className="block truncate text-[10px] font-normal text-faint">
                        {nameById.get(t.ownerId)}
                      </span>
                    )}
                    {showCups && (teamCups[t.id ?? ""] ?? []).length > 0 && (
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {(teamCups[t.id ?? ""] ?? []).map((c, i) => (
                          <span
                            key={`${c.name}-${i}`}
                            title={c.status}
                            className={`max-w-full truncate rounded px-1 py-0.5 text-[9px] font-semibold ${
                              c.status === "Em andamento"
                                ? "bg-win/20 text-win"
                                : "bg-faint/15 text-faint"
                            }`}
                          >
                            {c.name}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 shrink-0 text-xs text-faint">
                    {t.roster.filter((m) => m.active).length} jog.
                  </span>
                </button>
              </li>
            );
            // OFF agrupado POR COPA: cabeçalho da copa em cima, times embaixo,
            // quebra, e repete. Um time em várias copas aparece em cada uma.
            const offByCup = new Map<string, { status: string; teams: Team[] }>();
            const offNoCup: Team[] = [];
            for (const t of offTeams) {
              const cups = teamCups[t.id ?? ""] ?? [];
              if (cups.length === 0) {
                offNoCup.push(t);
                continue;
              }
              for (const c of cups) {
                if (!offByCup.has(c.name)) offByCup.set(c.name, { status: c.status, teams: [] });
                offByCup.get(c.name)!.teams.push(t);
              }
            }
            const offCups = [...offByCup.entries()].sort(
              (a, b) =>
                Number(b[1].status === "Em andamento") - Number(a[1].status === "Em andamento") ||
                a[0].localeCompare(b[0]),
            );
            return (
              <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
                <div>
                  <div className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-win">
                    Times ON ({onTeams.length})
                  </div>
                  <ul className="flex flex-col gap-1 text-sm">
                    {onTeams.map((t) => item(t))}
                    {onTeams.length === 0 && (
                      <li className="px-2 py-1 text-xs text-faint">Nenhum time ON.</li>
                    )}
                  </ul>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="px-1 text-[10px] font-bold uppercase tracking-wide text-faint">
                    Times OFF ({offTeams.length}) — por copa
                  </div>
                  {offTeams.length === 0 && (
                    <p className="px-2 text-xs text-faint">Nenhum time OFF.</p>
                  )}
                  {offCups.map(([cupName, info]) => (
                    <div key={cupName}>
                      <div
                        className={`mb-1 flex items-center gap-1.5 px-1 text-xs font-bold ${
                          info.status === "Em andamento" ? "text-win" : "text-white"
                        }`}
                      >
                        <Icon name="trophy" className="text-[10px]" />
                        <span className="truncate">{cupName}</span>
                        <span className="font-normal text-faint">({info.teams.length})</span>
                      </div>
                      <ul className="flex flex-col gap-1 text-sm">{info.teams.map((t) => item(t, false))}</ul>
                    </div>
                  ))}
                  {offNoCup.length > 0 && (
                    <div>
                      <div className="mb-1 px-1 text-xs font-bold text-faint">Sem copa</div>
                      <ul className="flex flex-col gap-1 text-sm">
                        {offNoCup.map((t) => item(t, false))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
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

              <label className="flex flex-col gap-1 text-xs">
                Dono do time <span className="text-faint">(diferencia times de mesmo nome)</span>
                <select
                  value={draft.ownerId ?? ""}
                  onChange={(e) => setDraft({ ...draft, ownerId: e.target.value || null })}
                  className="rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                >
                  <option value="">— Sem dono —</option>
                  {allPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
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

              <p className="rounded-md bg-panel/50 p-2.5 text-[11px] text-faint">
                📊 <b className="text-white">Títulos, vices, campeonatos jogados e V/E/D</b> são
                calculados automaticamente das copas e partidas (campeão/vice de cada torneio e
                resultados das súmulas). Não há mais digitação manual aqui.
              </p>

              {/* ELENCO */}
              <div className="border-t border-white/5 pt-3">
                {/* Escopo: elenco geral (aba Times) ou de um campeonato específico */}
                {draft.id && (teamCups[draft.id] ?? []).length > 0 && (
                  <label className="mb-3 flex flex-col gap-1 text-xs">
                    <span className="font-bold">Editando o elenco de:</span>
                    <select
                      value={scope}
                      onChange={(e) => changeScope(e.target.value)}
                      className={`rounded-md p-2 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-gold/50 ${
                        scope ? "bg-gold/15 ring-1 ring-gold/40" : "bg-panel"
                      }`}
                    >
                      <option value="">Geral (aba Times)</option>
                      {(teamCups[draft.id] ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          🏆 {c.name}
                          {c.status === "Em andamento" ? " — em andamento" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold">
                    {scope
                      ? `Elenco nesta copa (${currentRoster.length})`
                      : `Elenco (${currentRoster.filter((m) => m.active).length} ativos${
                          currentRoster.some((m) => !m.active)
                            ? `, ${currentRoster.filter((m) => !m.active).length} ex`
                            : ""
                        })`}
                  </span>
                </div>
                <p className="mb-2 rounded-md bg-panel/50 p-2.5 text-[11px] text-faint">
                  {scope ? (
                    <>
                      Elenco do time <b className="text-white">NESTA copa</b> (época). Pode incluir
                      qualquer jogador. As mudanças valem{" "}
                      <b className="text-white">só para este campeonato</b> — não afetam o elenco
                      geral nem outras copas.
                    </>
                  ) : (
                    <>
                      Elenco <b className="text-white">geral/atual</b> do time (aba Times). Para
                      mexer no elenco de uma copa específica, escolha o campeonato acima.
                    </>
                  )}
                </p>

                {/* Lista de membros: posição (+ status Ativo/Ex no geral) + remover */}
                {currentRoster.length > 0 && (
                  <ul className="mb-3 flex flex-col gap-1.5">
                    {currentRoster.map((m) => (
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

                        {/* Status Ativo/Ex — só no elenco geral (copa não usa) */}
                        {!scope && (
                          <button
                            type="button"
                            onClick={() => setActive(m.playerId, !m.active)}
                            className={`rounded px-2 py-1 text-[11px] font-bold ${
                              m.active ? "bg-win/20 text-win" : "bg-faint/20 text-faint"
                            }`}
                            title="Alternar entre Ativo e Ex-jogador"
                          >
                            {m.active ? "Ativo" : "Ex"}
                          </button>
                        )}

                        {/* Remover */}
                        <button
                          type="button"
                          onClick={() => removePlayer(m.playerId)}
                          className="rounded px-1.5 py-1 text-xs text-loss hover:bg-loss/10"
                          title="Remover do elenco"
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
                    const sel = currentRoster.some((m) => m.playerId === p.id);
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
                {draft.id && !scope && (
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
                  {busy ? "Salvando…" : scope ? "Salvar elenco da copa" : "Salvar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
