"use client";

import React, { useState, useEffect, useMemo } from "react";
import { tickSimulation, createInitialSimulationState, type SimulationState } from "@/lib/simulation";
import { type TournamentTeam, type MatchEvent } from "@/lib/tournamentTypes";
import Icon from "@/components/ui/Icon";
import FifaCard from "@/components/players/FifaCard";

interface LiveMatchHubProps {
    teamA: TournamentTeam;
    teamB: TournamentTeam;
    onFinished: (scoreA: number, scoreB: number, events: MatchEvent[]) => void;
}

export function LiveMatchHub({ teamA, teamB, onFinished }: LiveMatchHubProps) {
    const [speed, setSpeed] = useState<number>(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [state, setState] = useState<SimulationState>(() => createInitialSimulationState(teamA, teamB));

    const [tabA, setTabA] = useState<"events" | "lineup">("events");
    const [tabB, setTabB] = useState<"events" | "lineup">("events");

    useEffect(() => {
        if (!isPlaying || state.isFinished) return;

        const intervalMs = Math.max(1000 / (speed * 10), 50);

        const timer = setInterval(() => {
            setState(prev => tickSimulation(prev, teamA, teamB));
        }, intervalMs);

        return () => clearInterval(timer);
    }, [isPlaying, speed, state.isFinished, teamA, teamB]);

    const handleSkipToEnd = () => {
        let currentState = state;
        while (!currentState.isFinished) {
            currentState = tickSimulation(currentState, teamA, teamB);
        }
        setState(currentState);
        setIsPlaying(false);
    };

    const handleConclude = () => {
        if (state.isFinished) {
            onFinished(state.scoreHome, state.scoreAway, state.events);
        }
    };

    // Separação de Titulares e Reservas idêntica à simulação (1 GK + 3 de linha)
    // Time A
    const { startersA, reservesA } = useMemo(() => {
        const players = teamA.players || [];

        // Puxa os titulares que foram definidos de fato pela simulação
        const starters = state.homeStarters || [];

        // Filtra os reservas garantindo que não estão na lista de titulares do state
        const reserves = players.filter(p => !starters.some(s => s.id === p.id));

        return { startersA: starters, reservesA: reserves };
    }, [teamA.players, state.homeStarters]);

    // Time B
    const { startersB, reservesB } = useMemo(() => {
        const players = teamB.players || [];

        // Puxa os titulares que foram definidos de fato pela simulação
        const starters = state.awayStarters || [];

        // Filtra os reservas garantindo que não estão na lista de titulares do state
        const reserves = players.filter(p => !starters.some(s => s.id === p.id));

        return { startersB: starters, reservesB: reserves };
    }, [teamB.players, state.awayStarters]);

    // Distribuição tática dos titulares dentro das linhas do campo
    const positionsOrder = ["ATK", "MID", "ZAG", "GK"] as const;

    const categorizeStarters = (starters: any[]) => {
        const rows: Record<"ATK" | "MID" | "ZAG" | "GK", any[]> = { ATK: [], MID: [], ZAG: [], GK: [] };

        starters.forEach(p => {
            const pos = (p.position || "").toUpperCase();
            if (pos.includes("ATK") || pos.includes("ATA") || pos.includes("CA") || pos.includes("PE") || pos.includes("PD")) {
                rows.ATK.push(p);
            } else if (pos.includes("MID") || pos.includes("MEI") || pos.includes("VOL") || pos.includes("MC")) {
                rows.MID.push(p);
            } else if (pos.includes("ZAG") || pos.includes("DEF") || pos.includes("LE") || pos.includes("LD") || pos.includes("CB")) {
                rows.ZAG.push(p);
            } else if (pos.includes("GK") || pos.includes("GOL") || pos.includes("PO")) {
                rows.GK.push(p);
            } else {
                rows.MID.push(p); // Fallback seguro
            }
        });
        return rows;
    };

    const tacticalA = useMemo(() => categorizeStarters(startersA), [startersA]);
    const tacticalB = useMemo(() => categorizeStarters(startersB), [startersB]);

    const homeEvents = useMemo(() =>
        state.events.filter(ev => ev.teamId === teamA.id).reverse(),
        [state.events, teamA.id]
    );

    const awayEvents = useMemo(() =>
        state.events.filter(ev => ev.teamId === teamB.id).reverse(),
        [state.events, teamB.id]
    );

    return (
        <div className="w-full max-w-4xl mx-auto bg-panel/30 border border-white/5 rounded-3xl p-4 sm:p-6 shadow-2xl animate-content-in">
            {/* Placar Principal */}
            <div className="grid grid-cols-3 items-center bg-card rounded-2xl border border-white/5 p-4 sm:p-6 shadow-lg mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                {/* Time Casa */}
                <div className="flex flex-col items-center text-center gap-1 sm:gap-2 relative z-10 min-w-0">
                    {teamA.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={teamA.logo}
                            alt=""
                            className="h-12 w-12 sm:h-16 sm:w-16 object-contain drop-shadow-md"
                            onError={(e) => (e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E👤%3C/text%3E%3C/svg%3E")}
                        />
                    ) : (
                        <div className="h-12 w-12 sm:h-16 sm:w-16 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 text-xl sm:text-2xl">👤</div>
                    )}
                    <span className="text-sm sm:text-lg font-bold tracking-tight text-white truncate w-full px-1">{teamA.name}</span>
                    <div className="text-[9px] sm:text-[10px] text-faint uppercase font-black">Power: {Math.round(state.homePower)}</div>
                </div>

                {/* Tempo e Gols */}
                <div className="flex flex-col items-center justify-center relative z-10">
                    <div className="text-[9px] sm:text-[11px] font-bold text-gold uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-1 sm:mb-2 px-2 py-0.5 rounded bg-gold/10 border border-gold/20 whitespace-nowrap">
                        {state.isFinished ? "Fim de Jogo" : `${state.minute}'`}
                    </div>
                    <div className="text-3xl sm:text-6xl font-black text-white tracking-tighter tabular-nums flex items-center gap-2 sm:gap-4">
                        <span className={state.scoreHome > state.scoreAway && state.isFinished ? "text-gold" : ""}>{state.scoreHome}</span>
                        <span className="text-white/10 text-xl sm:text-4xl font-light">:</span>
                        <span className={state.scoreAway > state.scoreHome && state.isFinished ? "text-gold" : ""}>{state.scoreAway}</span>
                    </div>
                </div>

                {/* Time Fora */}
                <div className="flex flex-col items-center text-center gap-1 sm:gap-2 relative z-10 min-w-0">
                    {teamB.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={teamB.logo}
                            alt=""
                            className="h-12 w-12 sm:h-16 sm:w-16 object-contain drop-shadow-md"
                            onError={(e) => (e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E👤%3C/text%3E%3C/svg%3E")}
                        />
                    ) : (
                        <div className="h-12 w-12 sm:h-16 sm:w-16 flex items-center justify-center bg-white/5 rounded-2xl border border-white/10 text-xl sm:text-2xl">👤</div>
                    )}
                    <span className="text-sm sm:text-lg font-bold tracking-tight text-white truncate w-full px-1">{teamB.name}</span>
                    <div className="text-[9px] sm:text-[10px] text-faint uppercase font-black">Power: {Math.round(state.awayPower)}</div>
                </div>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-6 sm:mb-8">
                <div
                    className="bg-gold h-full transition-all duration-300 shadow-[0_0_10px_rgba(255,179,0,0.5)]"
                    style={{ width: `${(state.minute / 90) * 100}%` }}
                />
            </div>

            {/* Controles da Partida */}
            <div className="bg-white/[0.02] p-3 sm:p-4 rounded-2xl border border-white/5 mb-6 sm:mb-8">
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-between md:gap-4">
                    <button
                        onClick={() => !state.isFinished && setIsPlaying(!isPlaying)}
                        className={`col-span-2 md:col-span-1 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest px-4 py-3.5 rounded-xl transition-all w-full md:w-auto md:px-6 md:py-3 ${state.isFinished
                            ? "bg-white/[0.02] text-white/20 border border-white/5 pointer-events-none"
                            : isPlaying
                                ? "bg-white text-black shadow-lg"
                                : "bg-gold text-black hover:bg-yellow-400 shadow-lg shadow-gold/10 active:scale-95"
                            }`}
                    >
                        <Icon name={isPlaying ? "pause" : "play"} className="w-4 h-4 shrink-0" />
                        <span className="truncate">{isPlaying ? "Pausar" : state.minute === 0 ? "Iniciar" : "Retomar"}</span>
                    </button>

                    <div className={`col-span-1 flex items-center justify-between p-1 bg-black/40 rounded-xl border border-white/5 w-full md:w-auto gap-2 transition-all ${state.isFinished ? "opacity-30 pointer-events-none grayscale" : ""}`}>
                        <div className="flex items-center gap-1 flex-1 justify-center md:flex-none">
                            {([1, 2, 4] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSpeed(s)}
                                    className={`text-[10px] font-black flex-1 h-9 w-10 md:flex-none md:h-8 md:w-10 flex items-center justify-center rounded-lg transition-all ${speed === s
                                        ? "bg-gold text-black shadow-md"
                                        : "text-faint hover:text-white hover:bg-white/5"
                                        }`}
                                >
                                    {s}X
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleSkipToEnd}
                        disabled={state.isFinished}
                        className={`col-span-1 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest px-4 py-3.5 rounded-xl border transition-all w-full md:w-auto md:px-5 md:py-3 ${state.isFinished
                            ? "border-white/5 bg-white/[0.01] text-white/10 pointer-events-none"
                            : "border-white/10 bg-white/[0.02] text-faint hover:text-white hover:bg-white/5 active:scale-95"
                            }`}
                    >
                        <Icon name="fast-forward" className="w-3.5 h-3.5 shrink-0 opacity-60" />
                        <span className="truncate">Pular Fim</span>
                    </button>
                </div>

                {state.isFinished && (
                    <button
                        onClick={handleConclude}
                        className="w-full mt-3 bg-gold text-black font-black uppercase tracking-[0.2em] py-4 rounded-xl shadow-2xl hover:shadow-gold/20 transition-all active:scale-[0.98] animate-bounce-in text-xs block text-center"
                    >
                        Continuar Torneio
                    </button>
                )}
            </div>

            {/* Painéis Inferiores Dinâmicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Painel do Time A */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-blue-500/[0.04] border border-blue-500/10 rounded-xl p-1.5">
                        <div className="flex items-center gap-1 flex-1">
                            <button
                                onClick={() => setTabA("events")}
                                className={`text-[10px] uppercase font-black tracking-wider px-3 py-1.5 rounded-lg transition-all ${tabA === "events" ? "bg-blue-500/20 text-blue-400" : "text-faint hover:text-white"}`}
                            >
                                Lances
                            </button>
                            <button
                                onClick={() => setTabA("lineup")}
                                className={`text-[10px] uppercase font-black tracking-wider px-3 py-1.5 rounded-lg transition-all ${tabA === "lineup" ? "bg-blue-500/20 text-blue-400" : "text-faint hover:text-white"}`}
                            >
                                Elenco
                            </button>
                        </div>
                        <span className="text-[10px] font-bold text-white bg-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 mr-1">
                            {state.events.filter(e => e.teamId === teamA.id && e.type === "GOAL").length} ⚽
                        </span>
                    </div>

                    <div className="bg-black/20 rounded-2xl border border-white/5 p-4 h-[440px] overflow-y-auto custom-scrollbar">
                        {tabA === "events" ? (
                            <div className="flex flex-col gap-3">
                                {homeEvents.length === 0 ? (
                                    <div className="text-faint text-[10px] font-bold uppercase tracking-widest italic opacity-40 text-center py-16">
                                        Sem lances marcantes
                                    </div>
                                ) : (
                                    homeEvents.map((ev, idx) => (
                                        <div key={`home-${ev.minute}-${idx}`} className="flex gap-3 items-start p-3 rounded-xl border border-blue-500/5 bg-blue-500/[0.02] animate-content-in">
                                            <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">{ev.minute}&apos;</div>
                                            <div className="flex-1 min-w-0 text-xs text-white font-medium flex items-center gap-1.5">
                                                {ev.type === "GOAL" && "⚽"}
                                                {ev.type === "OWN_GOAL" && "❌"}
                                                {ev.type === "YELLOW_CARD" && "🟨"}
                                                {ev.type === "RED_CARD" && "🟥"}
                                                {ev.type === "SECOND_YELLOW" && "🟨🟥"}
                                                <span className="font-black italic uppercase truncate">
                                                    {ev.type === "OWN_GOAL" ? `[GC] ${ev.playerName}` : ev.playerName}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            /* Elenco com Estilo Campo de Futebol (Time A) */
                            <div className="flex flex-col gap-5">
                                <div className="relative w-full aspect-[9/16] bg-panel/30 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                                    {/* Linhas do Campo */}
                                    <div className="absolute inset-0 pointer-events-none opacity-10">
                                        <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white rounded-full" />
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-12 border border-white border-t-0 rounded-b-xl" />
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-12 border border-white border-b-0 rounded-t-xl" />
                                    </div>

                                    {/* Textura da Grama */}
                                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, #fff 30px, #fff 60px)' }} />

                                    {/* Jogadores Titulares dispostos taticamente */}
                                    <div className="relative h-full flex flex-col justify-around py-2 px-2">
                                        {positionsOrder.map((pos) => {
                                            const playersInRow = tacticalA[pos];
                                            return (
                                                <div key={pos} className="flex justify-center items-center h-1/4 w-full gap-2 px-1">
                                                    {playersInRow.map((player) => (
                                                        <div key={player.id} className="w-16 sm:w-20 transition-all duration-300 transform hover:scale-105 drop-shadow-2xl">
                                                            <FifaCard
                                                                player={player.hofData || player}
                                                                overall={player.overall}
                                                                label=""
                                                                isAuge={true}
                                                                position={player.position}
                                                                teamLogo={player.teamLogo || teamA.logo}
                                                                teamName={player.teamName || teamA.name}
                                                            />
                                                        </div>
                                                    ))}
                                                    {playersInRow.length === 0 && (
                                                        <div className="w-12 h-16 border border-dashed border-white/5 bg-white/[0.02] rounded-lg flex items-center justify-center">
                                                            <span className="text-[8px] font-bold uppercase tracking-widest text-faint/40">{pos}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Reservas do Time A */}
                                {reservesA.length > 0 && (
                                    <div>
                                        <h4 className="text-[9px] font-black tracking-widest uppercase text-faint mb-2">Reservas</h4>
                                        <div className="grid grid-cols-1 gap-1.5 opacity-75">
                                            {reservesA.map(p => (
                                                <div key={p.id} className="text-xs font-medium text-white/80 bg-white/[0.02] px-3 py-2 rounded-lg border border-white/5 flex items-center justify-between gap-2">
                                                    <span className="truncate">👤 {p.name || "Jogador"} ({p.overall})</span>
                                                    <span className="text-[9px] font-black bg-white/5 text-faint px-1.5 py-0.5 rounded border border-white/5 uppercase shrink-0">
                                                        {p.position || "SUB"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Painel do Time B */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-red-500/[0.04] border border-red-500/10 rounded-xl p-1.5">
                        <div className="flex items-center gap-1 flex-1">
                            <button
                                onClick={() => setTabB("events")}
                                className={`text-[10px] uppercase font-black tracking-wider px-3 py-1.5 rounded-lg transition-all ${tabB === "events" ? "bg-red-500/20 text-red-400" : "text-faint hover:text-white"}`}
                            >
                                Lances
                            </button>
                            <button
                                onClick={() => setTabB("lineup")}
                                className={`text-[10px] uppercase font-black tracking-wider px-3 py-1.5 rounded-lg transition-all ${tabB === "lineup" ? "bg-red-500/20 text-red-400" : "text-faint hover:text-white"}`}
                            >
                                Elenco
                            </button>
                        </div>
                        <span className="text-[10px] font-bold text-white bg-red-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 mr-1">
                            {state.events.filter(e => e.teamId === teamB.id && e.type === "GOAL").length} ⚽
                        </span>
                    </div>

                    <div className="bg-black/20 rounded-2xl border border-white/5 p-4 h-[440px] overflow-y-auto custom-scrollbar">
                        {tabB === "events" ? (
                            <div className="flex flex-col gap-3">
                                {awayEvents.length === 0 ? (
                                    <div className="text-faint text-[10px] font-bold uppercase tracking-widest italic opacity-40 text-center py-16">
                                        Sem lances marcantes
                                    </div>
                                ) : (
                                    awayEvents.map((ev, idx) => (
                                        <div key={`away-${ev.minute}-${idx}`} className="flex gap-3 items-start p-3 rounded-xl border border-red-500/5 bg-red-500/[0.02] animate-content-in">
                                            <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">{ev.minute}&apos;</div>
                                            <div className="flex-1 min-w-0 text-xs text-white font-medium flex items-center gap-1.5">
                                                {ev.type === "GOAL" && "⚽"}
                                                {ev.type === "OWN_GOAL" && "❌"}
                                                {ev.type === "YELLOW_CARD" && "🟨"}
                                                {ev.type === "RED_CARD" && "🟥"}
                                                {ev.type === "SECOND_YELLOW" && "🟨🟥"}
                                                <span className="font-black italic uppercase truncate">
                                                    {ev.type === "OWN_GOAL" ? `[GC] ${ev.playerName}` : ev.playerName}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            /* Elenco com Estilo Campo de Futebol (Time B) */
                            <div className="flex flex-col gap-5">
                                <div className="relative w-full aspect-[9/16] bg-panel/30 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
                                    {/* Linhas do Campo */}
                                    <div className="absolute inset-0 pointer-events-none opacity-10">
                                        <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white rounded-full" />
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-12 border border-white border-t-0 rounded-b-xl" />
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-12 border border-white border-b-0 rounded-t-xl" />
                                    </div>

                                    {/* Textura da Grama */}
                                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, #fff 30px, #fff 60px)' }} />

                                    {/* Jogadores Titulares dispostos taticamente */}
                                    <div className="relative h-full flex flex-col justify-around py-2 px-2">
                                        {positionsOrder.map((pos) => {
                                            const playersInRow = tacticalB[pos];
                                            return (
                                                <div key={pos} className="flex justify-center items-center h-1/4 w-full gap-2 px-1">
                                                    {playersInRow.map((player) => (
                                                        <div key={player.id} className="w-16 sm:w-20 transition-all duration-300 transform hover:scale-105 drop-shadow-2xl">
                                                            <FifaCard
                                                                player={player.hofData || player}
                                                                overall={player.overall}
                                                                label=""
                                                                isAuge={true}
                                                                position={player.position}
                                                                teamLogo={player.teamLogo || teamB.logo}
                                                                teamName={player.teamName || teamB.name}
                                                            />
                                                        </div>
                                                    ))}
                                                    {playersInRow.length === 0 && (
                                                        <div className="w-12 h-16 border border-dashed border-white/5 bg-white/[0.02] rounded-lg flex items-center justify-center">
                                                            <span className="text-[8px] font-bold uppercase tracking-widest text-faint/40">{pos}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Reservas do Time B */}
                                {reservesB.length > 0 && (
                                    <div>
                                        <h4 className="text-[9px] font-black tracking-widest uppercase text-faint mb-2">Reservas</h4>
                                        <div className="grid grid-cols-1 gap-1.5 opacity-75">
                                            {reservesB.map(p => (
                                                <div key={p.id} className="text-xs font-medium text-white/80 bg-white/[0.02] px-3 py-2 rounded-lg border border-white/5 flex items-center justify-between gap-2">
                                                    <span className="truncate">👤 {p.name || "Jogador"}</span>
                                                    <span className="text-[9px] font-black bg-white/5 text-faint px-1.5 py-0.5 rounded border border-white/5 uppercase shrink-0">
                                                        {p.position || "SUB"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}