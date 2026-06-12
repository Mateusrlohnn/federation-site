"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "@/components/ui/ImageUpload";
import { POSITIONS, asPosition, type Position } from "@/lib/teams";
import { avatarUrl } from "@/lib/hof";

type Lite = { id: string; name: string };

type DraftTeamPlayer = {
    playerId: string;
    position: Position | null;
    overall: number | null;
};

type DraftTeam = {
    id?: string;
    name: string;
    season: string;
    logoUrl: string;
    active: boolean;
    players: DraftTeamPlayer[];
};

function emptyTeam(): DraftTeam {
    return { name: "", season: "", logoUrl: "", active: true, players: [] };
}

function teamFromRow(r: Record<string, unknown>): DraftTeam {
    const players =
        (r.draft_team_players as
            | { player_id: string; position: string | null; overall: number | null }[]
            | undefined) ?? [];
    return {
        id: r.id as string,
        name: String(r.name),
        season: String(r.season ?? ""),
        logoUrl: (r.logo_url as string) ?? "",
        active: r.active !== false,
        players: players.map((p) => ({
            playerId: p.player_id,
            position: asPosition(p.position),
            overall: p.overall ?? null,
        })),
    };
}

export default function AdminDraftPage() {
    const supabase = createClient();

    const [list, setList] = useState<DraftTeam[]>([]);
    const [allPlayers, setAllPlayers] = useState<Lite[]>([]);
    const [playerNick, setPlayerNick] = useState<Record<string, string>>({});
    const [playerPos, setPlayerPos] = useState<Record<string, Position | null>>({});

    const [draft, setDraft] = useState<DraftTeam | null>(null);
    const [rosterQ, setRosterQ] = useState("");

    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    const inputC =
        "rounded-md bg-panel p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/50";

    // ── loaders ────────────────────────────────────────────────────────────────

    const loadLists = useCallback(async () => {
        const [teams, players] = await Promise.all([
            supabase
                .from("draft_teams")
                .select("*, draft_team_players(player_id, position, overall)")
                .order("season", { ascending: false }),
            supabase.from("players").select("id, name, nick, position").order("name"),
        ]);

        if (!teams.error && teams.data)
            setList(teams.data.map((r) => teamFromRow(r as Record<string, unknown>)));

        if (!players.error && players.data) {
            const pl = players.data as {
                id: string;
                name: string;
                nick: string | null;
                position: Position | null;
            }[];
            setAllPlayers(pl.map((p) => ({ id: p.id, name: p.name })));
            const nick: Record<string, string> = {};
            const pos: Record<string, Position | null> = {};
            pl.forEach((p) => {
                nick[p.id] = p.nick?.trim() || p.name;
                pos[p.id] = p.position ?? null;
            });
            setPlayerNick(nick);
            setPlayerPos(pos);
        }
    }, [supabase]);

    useEffect(() => {
        loadLists();
    }, [loadLists]);

    // ── helpers ────────────────────────────────────────────────────────────────

    const playerName = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;

    function select(t: DraftTeam | null) {
        setErr("");
        setMsg("");
        setRosterQ("");
        setDraft(t ? { ...t } : null);
    }

    function finish(error: string) {
        setBusy(false);
        setErr(error);
    }

    // ── roster helpers (local state, persisted on save) ────────────────────────

    function addPlayer(id: string) {
        setDraft((d) => {
            if (!d || d.players.some((p) => p.playerId === id)) return d;
            return {
                ...d,
                players: [
                    ...d.players,
                    { playerId: id, position: playerPos[id] ?? null, overall: null },
                ],
            };
        });
    }

    function removePlayer(id: string) {
        setDraft((d) => d ? { ...d, players: d.players.filter((p) => p.playerId !== id) } : d);
    }

    function setPosition(id: string, position: Position | null) {
        setDraft((d) =>
            d
                ? { ...d, players: d.players.map((p) => p.playerId === id ? { ...p, position } : p) }
                : d,
        );
    }

    function setOverall(id: string, value: string) {
        setDraft((d) =>
            d
                ? {
                    ...d,
                    players: d.players.map((p) =>
                        p.playerId === id
                            ? { ...p, overall: value === "" ? null : Number(value) }
                            : p,
                    ),
                }
                : d,
        );
    }

    // ── save / remove ──────────────────────────────────────────────────────────

    async function saveTeam() {
        if (!draft) return;
        if (!draft.name.trim()) return setErr("Informe o nome do time.");
        if (!draft.season.trim()) return setErr("Informe a temporada.");
        setBusy(true);
        setErr("");
        setMsg("");

        const row = {
            name: draft.name.trim(),
            season: draft.season.trim(),
            logo_url: draft.logoUrl?.trim() || null,
            active: draft.active,
        };

        let tid = draft.id;
        if (tid) {
            const { error } = await supabase.from("draft_teams").update(row).eq("id", tid);
            if (error) return finish(error.message);
        } else {
            const { data, error } = await supabase
                .from("draft_teams")
                .insert(row)
                .select("id")
                .single();
            if (error || !data) return finish(error?.message ?? "Erro ao criar time.");
            tid = (data as { id: string }).id;
        }

        // sync players: delete + reinsert
        await supabase.from("draft_team_players").delete().eq("draft_team_id", tid);
        if (draft.players.length) {
            const { error: pe } = await supabase.from("draft_team_players").insert(
                draft.players.map((p) => ({
                    draft_team_id: tid,
                    player_id: p.playerId,
                    position: p.position ?? null,
                    overall: p.overall ?? null,
                })),
            );
            if (pe) return finish(pe.message);
        }

        setBusy(false);
        setMsg(`Time "${draft.name}" salvo.`);
        setDraft({ ...draft, id: tid });
        await loadLists();
    }

    async function removeTeam() {
        if (!draft?.id) return;
        if (!confirm(`Remover o time "${draft.name}"?`)) return;
        setBusy(true);
        const { error } = await supabase.from("draft_teams").delete().eq("id", draft.id);
        setBusy(false);
        if (error) return setErr(error.message);
        setMsg("Time removido.");
        select(null);
        await loadLists();
    }

    // ── filtered lists ─────────────────────────────────────────────────────────

    const filteredPlayers = allPlayers.filter((p) =>
        p.name.toLowerCase().includes(rosterQ.toLowerCase().trim()),
    );

    // ── render ─────────────────────────────────────────────────────────────────

    return (
        <>
            {(msg || err) && (
                <div
                    className={`mb-4 rounded-md p-3 text-xs ${err ? "bg-loss/10 text-loss" : "bg-win/10 text-win"
                        }`}
                >
                    {err || msg}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-[280px_1fr]">
                {/* ── LISTA ──────────────────────────────────────────────────── */}
                <div className="flex h-max flex-col gap-3 rounded-lg bg-card p-3">
                    <button
                        onClick={() => select(emptyTeam())}
                        className="rounded-md bg-gold py-2 text-sm font-bold text-[#1a1a1e] hover:opacity-90"
                    >
                        + Novo time Draft
                    </button>
                    <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto text-sm">
                        {list.map((t) => (
                            <li key={t.id}>
                                <button
                                    onClick={() => select(t)}
                                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-panel ${draft?.id === t.id ? "bg-panel ring-1 ring-gold" : ""
                                        }`}
                                >
                                    {t.logoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={t.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
                                    ) : (
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-base text-[10px] text-faint">
                                            ⚽
                                        </span>
                                    )}
                                    <span className="flex-1 truncate">{t.name}</span>
                                    <span className="shrink-0 text-[10px] text-faint">{t.season}</span>
                                    {!t.active && (
                                        <span className="shrink-0 rounded bg-white/10 px-1 text-[10px] text-faint">
                                            off
                                        </span>
                                    )}
                                </button>
                            </li>
                        ))}
                        {list.length === 0 && (
                            <li className="px-2 py-1 text-xs text-faint">Nenhum time Draft.</li>
                        )}
                    </ul>
                </div>

                {/* ── EDITOR ─────────────────────────────────────────────────── */}
                <div className="rounded-lg bg-card p-4">
                    {!draft ? (
                        <p className="text-sm text-faint">
                            Selecione um time, ou clique em <b>+ Novo time Draft</b>.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {/* logo */}
                            <ImageUpload
                                label="Logo do time (quadrada)"
                                folder="draft-teams"
                                value={draft.logoUrl}
                                onChange={(url) => setDraft({ ...draft, logoUrl: url })}
                            />

                            {/* campos básicos */}
                            <div className="grid gap-3 sm:grid-cols-[1fr_180px_120px]">
                                <label className="flex flex-col gap-1 text-xs">
                                    Nome do time
                                    <input
                                        className={inputC}
                                        value={draft.name}
                                        placeholder="ex: Time Alpha"
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-xs">
                                    Temporada
                                    <input
                                        className={inputC}
                                        value={draft.season}
                                        placeholder="ex: 2025/1"
                                        onChange={(e) => setDraft({ ...draft, season: e.target.value })}
                                    />
                                </label>
                                <label className="flex flex-col gap-1 text-xs">
                                    Status
                                    <select
                                        className={inputC}
                                        value={draft.active ? "active" : "inactive"}
                                        onChange={(e) => setDraft({ ...draft, active: e.target.value === "active" })}
                                    >
                                        <option value="active">Ativo</option>
                                        <option value="inactive">Inativo</option>
                                    </select>
                                </label>
                            </div>

                            {/* elenco */}
                            <div className="border-t border-white/5 pt-3">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-bold">
                                        Elenco ({draft.players.length} jogador{draft.players.length !== 1 ? "es" : ""})
                                    </span>
                                </div>

                                {/* jogadores já no elenco */}
                                {draft.players.length > 0 && (
                                    <ul className="mb-3 flex flex-col gap-1.5">
                                        {[...draft.players]
                                            .sort((a, b) => playerName(a.playerId).localeCompare(playerName(b.playerId)))
                                            .map((p) => (
                                                <li
                                                    key={p.playerId}
                                                    className="flex flex-wrap items-center gap-2 rounded-md bg-panel px-2 py-1.5"
                                                >
                                                    {/* avatar */}
                                                    <span className="flex h-9 w-8 shrink-0 items-end justify-center overflow-hidden rounded bg-base">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={avatarUrl(playerNick[p.playerId] || playerName(p.playerId))}
                                                            alt=""
                                                            className="object-contain"
                                                            style={{ width: 32, height: 42 }}
                                                        />
                                                    </span>

                                                    {/* nome */}
                                                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                                        {playerName(p.playerId)}
                                                    </span>

                                                    {/* posição */}
                                                    <select
                                                        value={p.position ?? ""}
                                                        onChange={(e) =>
                                                            setPosition(p.playerId, (e.target.value || null) as Position | null)
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

                                                    {/* overall */}
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={99}
                                                        value={p.overall ?? ""}
                                                        onChange={(e) => setOverall(p.playerId, e.target.value)}
                                                        placeholder="OVR"
                                                        className="w-14 rounded bg-base p-1 text-center text-xs font-bold text-gold focus:outline-none focus:ring-1 focus:ring-gold/50"
                                                    />

                                                    {/* remover */}
                                                    <button
                                                        type="button"
                                                        onClick={() => removePlayer(p.playerId)}
                                                        className="rounded px-1.5 py-1 text-xs text-loss hover:bg-loss/10"
                                                        title="Remover do elenco"
                                                    >
                                                        ✕
                                                    </button>
                                                </li>
                                            ))}
                                    </ul>
                                )}

                                {/* busca para adicionar — mesmo padrão do AdminTeamsPage */}
                                <input
                                    type="text"
                                    value={rosterQ}
                                    onChange={(e) => setRosterQ(e.target.value)}
                                    placeholder="Buscar jogador para adicionar..."
                                    className="mb-2 w-full rounded-md bg-panel p-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-gold/50"
                                />
                                <ul className="flex max-h-[200px] flex-col gap-0.5 overflow-y-auto rounded-md bg-panel p-1 text-sm">
                                    {filteredPlayers.slice(0, 60).map((p) => {
                                        const sel = draft.players.some((dp) => dp.playerId === p.id);
                                        return (
                                            <li key={p.id}>
                                                <button
                                                    onClick={() => (sel ? removePlayer(p.id) : addPlayer(p.id))}
                                                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-base ${sel ? "text-gold" : ""
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

                            {/* ações */}
                            <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-3">
                                {draft.id && (
                                    <button
                                        onClick={removeTeam}
                                        disabled={busy}
                                        className="rounded-md border border-loss/40 px-4 py-2 text-sm text-loss hover:bg-loss/10 disabled:opacity-60"
                                    >
                                        Remover
                                    </button>
                                )}
                                <button
                                    onClick={saveTeam}
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