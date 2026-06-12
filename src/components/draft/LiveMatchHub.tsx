"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { tickSimulation, createInitialSimulationState, type SimulationState } from "@/lib/simulation";
import { type TournamentTeam, type MatchEvent } from "@/lib/tournamentTypes";
import Icon from "@/components/ui/Icon";

interface LiveMatchHubProps {
    teamA: TournamentTeam;
    teamB: TournamentTeam;
    onFinished: (scoreA: number, scoreB: number, events: MatchEvent[]) => void;
}

export function LiveMatchHub({ teamA, teamB, onFinished }: LiveMatchHubProps) {
    const [speed, setSpeed] = useState<number>(1); // 1x, 2x, 4x
    const [isPlaying, setIsPlaying] = useState(false);
    const [state, setState] = useState<SimulationState>(() => createInitialSimulationState(teamA, teamB));

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

    // Filtra e divide a súmula em tempo real por time
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
            {/* Placar */}
            <div className="grid grid-cols-3 items-center bg-card rounded-2xl border border-white/5 p-4 sm:p-6 shadow-lg mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                {/* Time Casa */}
                <div className="flex flex-col items-center text-center gap-1 sm:gap-2 relative z-10 min-w-0">
                    {teamA.logo ? (
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

            {/* Progresso da Partida */}
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-6 sm:mb-8">
                <div
                    className="bg-gold h-full transition-all duration-300 shadow-[0_0_10px_rgba(255,179,0,0.5)]"
                    style={{ width: `${(state.minute / 90) * 100}%` }}
                />
            </div>

            {/* Painel de Controles Flexível & Mobile-Friendly */}
            <div className="bg-white/[0.02] p-3 sm:p-4 rounded-2xl border border-white/5 mb-6 sm:mb-8">
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:justify-between md:gap-4">

                    {/* Botão Jogar / Pausar */}
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

                    {/* Controlador de Velocidade */}
                    <div className={`col-span-1 flex items-center justify-between p-1 bg-black/40 rounded-xl border border-white/5 w-full md:w-auto gap-2 transition-all ${state.isFinished ? "opacity-30 pointer-events-none grayscale" : ""
                        }`}>
                        <span className="text-[10px] uppercase font-black tracking-wider text-faint pl-2 hidden sm:inline md:hidden">Velocidade:</span>
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

                    {/* Botão Pular Simulação (Corrigido para não sumir no Fim de Jogo) */}
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

                {/* Botão de Conclusão (Com efeito hover Premium para transição de tela) */}
                {state.isFinished && (
                    <button
                        onClick={handleConclude}
                        className="w-full mt-3 bg-gold text-black font-black uppercase tracking-[0.2em] py-4 rounded-xl shadow-2xl hover:shadow-gold/20 transition-all active:scale-[0.98] animate-bounce-in text-xs block text-center"
                    >
                        Continuar Torneio
                    </button>
                )}
            </div>

            {/* Súmula Dividida (Estatísticas e Eventos por Time) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Coluna do Time A */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-blue-500/[0.04] border border-blue-500/10 rounded-xl px-4 py-2.5">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-400 truncate max-w-[70%]">{teamA.name}</span>
                        <span className="text-[10px] font-bold text-white bg-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            {state.events.filter(e => e.teamId === teamA.id && e.type === "GOAL").length} ⚽
                        </span>
                    </div>

                    <div className="bg-black/20 rounded-2xl border border-white/5 p-4 min-h-[220px] max-h-[350px] overflow-y-auto flex flex-col gap-3 custom-scrollbar">
                        {homeEvents.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-faint text-[10px] font-bold uppercase tracking-widest italic opacity-40 py-8">
                                Sem lances marcantes
                            </div>
                        ) : (
                            homeEvents.map((ev, idx) => (
                                <div
                                    key={`home-${ev.minute}-${idx}`}
                                    className="flex gap-3 items-start p-3 rounded-xl border border-white/5 bg-blue-500/[0.02] border-blue-500/5 animate-content-in"
                                >
                                    <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shadow-sm shrink-0">
                                        {ev.minute}&apos;
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-white font-medium flex items-center gap-1.5 flex-wrap">
                                            {ev.type === "GOAL" && <span className="text-sm">⚽</span>}
                                            {ev.type === "OWN_GOAL" && <span className="text-sm">❌</span>}
                                            {ev.type === "YELLOW_CARD" && <span className="text-sm">🟨</span>}
                                            {ev.type === "RED_CARD" && <span className="text-sm">🟥</span>}
                                            {ev.type === "SECOND_YELLOW" && <span className="text-sm">🟨🟥</span>}
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="font-black italic uppercase tracking-tight truncate">
                                                    {ev.type === "OWN_GOAL" ? `[GC] ${ev.playerName}` : ev.playerName}
                                                </span>
                                            </div>
                                        </div>
                                        {ev.assistPlayerName && (
                                            <div className="mt-1 pl-5 text-[9px] font-bold text-gold uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-2 h-px bg-gold/30" />
                                                <span className="truncate">Asst: {ev.assistPlayerName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Coluna do Time B */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between bg-red-500/[0.04] border border-red-500/10 rounded-xl px-4 py-2.5">
                        <span className="text-xs font-black uppercase tracking-wider text-red-400 truncate max-w-[70%]">{teamB.name}</span>
                        <span className="text-[10px] font-bold text-white bg-red-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            {state.events.filter(e => e.teamId === teamB.id && e.type === "GOAL").length} ⚽
                        </span>
                    </div>

                    <div className="bg-black/20 rounded-2xl border border-white/5 p-4 min-h-[220px] max-h-[350px] overflow-y-auto flex flex-col gap-3 custom-scrollbar">
                        {awayEvents.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-faint text-[10px] font-bold uppercase tracking-widest italic opacity-40 py-8">
                                Sem lances marcantes
                            </div>
                        ) : (
                            awayEvents.map((ev, idx) => (
                                <div
                                    key={`away-${ev.minute}-${idx}`}
                                    className="flex gap-3 items-start p-3 rounded-xl border border-white/5 bg-red-500/[0.02] border-red-500/5 animate-content-in"
                                >
                                    <div className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shadow-sm shrink-0">
                                        {ev.minute}&apos;
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-white font-medium flex items-center gap-1.5 flex-wrap">
                                            {ev.type === "GOAL" && <span className="text-sm">⚽</span>}
                                            {ev.type === "OWN_GOAL" && <span className="text-sm">❌</span>}
                                            {ev.type === "YELLOW_CARD" && <span className="text-sm">🟨</span>}
                                            {ev.type === "RED_CARD" && <span className="text-sm">🟥</span>}
                                            {ev.type === "SECOND_YELLOW" && <span className="text-sm">🟨🟥</span>}
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="font-black italic uppercase tracking-tight truncate">
                                                    {ev.type === "OWN_GOAL" ? `[GC] ${ev.playerName}` : ev.playerName}
                                                </span>
                                            </div>
                                        </div>
                                        {ev.assistPlayerName && (
                                            <div className="mt-1 pl-5 text-[9px] font-bold text-gold uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-2 h-px bg-gold/30" />
                                                <span className="truncate">Asst: {ev.assistPlayerName}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}