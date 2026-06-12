"use client";

import React, { useState, useEffect, useMemo } from "react";
import { type DraftTeam } from "@/lib/draft";
import { type TournamentState, type MatchNode } from "@/lib/tournamentTypes";
import { createTournament } from "@/lib/bracket";
import { advanceBracket, autoSimulateAIMatches, hasUserBeenEliminated } from "@/lib/bracketProgression";
import { mapDraftTeamToTournament } from "@/lib/mappers";
import Icon from "@/components/ui/Icon";
import { LiveMatchHub } from "./LiveMatchHub";
import { EndScreen } from "./EndScreen";
import { TournamentBracket } from "./TournamentBracket";

type TournamentPhase = "IDLE" | "PLAYING_USER_MATCH" | "USER_ELIMINATED" | "FINISHED";

interface TournamentCenterProps {
    userTeam: DraftTeam;
    iaTeams: DraftTeam[];
    onResetDraft: () => void;
}

export function TournamentCenter({ userTeam, iaTeams, onResetDraft }: TournamentCenterProps) {
    const [phase, setPhase] = useState<TournamentPhase>("IDLE");
    const [tournament, setTournament] = useState<TournamentState | null>(null);
    const [activeMatch, setActiveMatch] = useState<MatchNode | null>(null);

    useEffect(() => {
        if (!tournament) {
            const userTournamentTeam = mapDraftTeamToTournament(userTeam, true);
            const iaTournamentTeams = iaTeams.slice(0, 7).map(t => mapDraftTeamToTournament(t));
            const allTeams = [userTournamentTeam, ...iaTournamentTeams];
            let state = createTournament(allTeams, userTournamentTeam.id);
            state = autoSimulateAIMatches(state);
            setTournament(state);
        }
    }, [userTeam, iaTeams, tournament]);

    const nextUserMatch = useMemo(() => {
        if (!tournament) return null;
        const allMatches = [...tournament.upperBracket, ...tournament.lowerBracket, tournament.grandFinal];
        return allMatches.find(m => m.status === "ready" && m.isUserMatch) ?? null;
    }, [tournament]);

    // BUG FIX #6: Separar as verificações de eliminação e fim de torneio evita
    // que a fase "FINISHED" seja pulada quando o torneio termina sem o usuário
    // estar na final (campeão diferente do usuário após Grand Final simulada por AI).
    useEffect(() => {
        if (!tournament || phase === "PLAYING_USER_MATCH") return;

        if (tournament.status === "finished") {
            setPhase("FINISHED");
            return;
        }

        if (hasUserBeenEliminated(tournament) && phase !== "USER_ELIMINATED") {
            setPhase("USER_ELIMINATED");
        }
    }, [tournament, phase]);

    const handleStartUserMatch = () => {
        if (nextUserMatch) {
            setActiveMatch(nextUserMatch);
            setPhase("PLAYING_USER_MATCH");
        }
    };

    const handleUserMatchFinished = (scoreHome: number, scoreAway: number, events: MatchNode["events"]) => {
        if (!tournament || !activeMatch) return;
        const winnerId = scoreHome > scoreAway ? activeMatch.homeTeamId! : activeMatch.awayTeamId!;
        const loserId = scoreHome > scoreAway ? activeMatch.awayTeamId! : activeMatch.homeTeamId!;
        let nextState = advanceBracket(tournament, activeMatch.id, winnerId, loserId, scoreHome, scoreAway, events);
        nextState = autoSimulateAIMatches(nextState);
        setTournament(nextState);
        setActiveMatch(null);
        setPhase("IDLE");
    };

    // BUG FIX #7: A implementação anterior manipulava `isUserMatch` diretamente
    // no clone, mas `activateMatch` (chamado dentro de `advanceBracket`) recalcula
    // `isUserMatch` pelo `userTeamId`, sobrescrevendo a alteração. 
    // A solução correta é que `autoSimulateAIMatches` já respeita `isUserMatch`
    // naturalmente — ela só simula partidas onde `isUserMatch === false`.
    // Para forçar a simulação do restante quando o usuário foi eliminado, basta
    // criar um state temporário onde o userTeamId não existe em nenhuma partida
    // ativa, fazendo todas as partidas restantes serem tratadas como AI.
    const handleAutoSimulateRest = () => {
        if (!tournament) return;
        // Cria um clone "sem usuário" para que autoSimulateAIMatches processe tudo
        const ghostState: TournamentState = structuredClone(tournament);
        ghostState.userTeamId = "__none__"; // Nenhuma partida vai ter isUserMatch=true
        [...ghostState.upperBracket, ...ghostState.lowerBracket, ghostState.grandFinal].forEach(m => {
            m.isUserMatch = false;
        });
        const simulated = autoSimulateAIMatches(ghostState);
        // Restaura o userTeamId original para o histórico e a tela final ficarem corretos
        simulated.userTeamId = tournament.userTeamId;
        setTournament(simulated);
    };

    if (!tournament) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white bg-[#0a0a0c]">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin" />
                    <p className="font-black uppercase tracking-widest text-xs text-gold">Organizando Chaves...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex flex-col items-center overflow-x-hidden">
            {/* Header */}
            <div className="w-full max-w-7xl mb-12 flex items-center justify-between animate-content-in">
                <div className="flex flex-col">
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic flex items-center gap-4">
                        <div className="w-2 h-10 bg-gold rounded-full shadow-[0_0_15px_rgba(255,179,0,0.5)]" />
                        Rebug Federation
                    </h1>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <p className="text-gold text-[10px] font-black tracking-[0.3em] uppercase">
                            <Icon name={tournament.status === "running" ? "play" : "trophy"} className="w-3 h-3 inline-block mr-1" />
                            Status: {tournament.status === "running" ? "Em Progresso" : "Finalizado"}
                        </p>
                    </div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-5 shadow-2xl backdrop-blur-xl">
                    <div className="text-right">
                        <div className="text-[9px] text-faint uppercase font-black tracking-widest mb-1">Seu Elenco</div>
                        <div className="text-sm text-white font-black italic uppercase tracking-tight">{userTeam.name}</div>
                    </div>
                    {userTeam.logoUrl && <img src={userTeam.logoUrl} alt="" className="h-12 w-12 object-contain drop-shadow-lg" />}
                </div>
            </div>

            <div className="w-full max-w-7xl flex-1">
                {phase === "IDLE" && (
                    <div className="space-y-12 animate-content-in">
                        {nextUserMatch && (
                            <div className="bg-card border-2 border-gold/30 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Icon name="swords" className="w-48 h-48 text-white" />
                                </div>
                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                                    <div className="flex-1 text-center md:text-left">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 mb-4">
                                            <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                                            <span className="text-[10px] font-black text-gold uppercase tracking-widest">{nextUserMatch.label}</span>
                                        </div>
                                        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-tight mb-4">
                                            Sua vez de <br /> entrar em campo
                                        </h2>
                                        <p className="text-faint font-medium max-w-md">O torneio está pausado aguardando seu resultado. Prepare sua estratégia!</p>
                                    </div>
                                    <div className="flex items-center gap-8 bg-black/20 p-8 rounded-3xl border border-white/5">
                                        <div className="flex flex-col items-center gap-3">
                                            <img src={nextUserMatch.homeTeam?.logo} className="h-20 w-20 object-contain" alt="" />
                                            <span className="text-xs font-black text-white uppercase tracking-tighter">{nextUserMatch.homeTeam?.name}</span>
                                        </div>
                                        <div className="text-4xl font-black text-gold italic">VS</div>
                                        <div className="flex flex-col items-center gap-3">
                                            <img src={nextUserMatch.awayTeam?.logo} className="h-20 w-20 object-contain" alt="" />
                                            <span className="text-xs font-black text-white uppercase tracking-tighter">{nextUserMatch.awayTeam?.name}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleStartUserMatch}
                                        className="px-12 py-6 bg-gold hover:bg-yellow-400 text-black font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_15px_30px_rgba(255,179,0,0.2)] transition-all hover:scale-105 active:scale-95 group"
                                    >
                                        Assistir Partida
                                        <Icon name="play" className="w-5 h-5 inline-block ml-3 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="bg-card/30 border border-white/5 rounded-[3rem] p-12 backdrop-blur-sm">
                            <TournamentBracket state={tournament} />
                        </div>
                    </div>
                )}

                {phase === "PLAYING_USER_MATCH" && activeMatch && (
                    <LiveMatchHub
                        teamA={activeMatch.homeTeam!}
                        teamB={activeMatch.awayTeam!}
                        onFinished={handleUserMatchFinished}
                    />
                )}

                {phase === "USER_ELIMINATED" && (
                    <div className="space-y-12 animate-content-in">
                        <div className="bg-red-500/10 border-2 border-red-500/20 rounded-[2.5rem] p-12 text-center relative overflow-hidden">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
                                <Icon name="skull" className="w-96 h-96 text-white" />
                            </div>
                            <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter mb-4">Eliminado!</h2>
                            <p className="text-red-200/60 font-medium max-w-xl mx-auto mb-10">Infelizmente sua jornada chegou ao fim. Mas a competição continua entre as IAs!</p>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
                                <button
                                    onClick={handleAutoSimulateRest}
                                    className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest rounded-xl transition-all"
                                >
                                    Simular até a Final
                                </button>
                                <button
                                    onClick={() => setPhase("FINISHED")}
                                    className="px-8 py-4 bg-gold hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-all"
                                >
                                    Ver Resultados Finais
                                </button>
                                <button
                                    onClick={onResetDraft}
                                    className="px-8 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/30"
                                >
                                    Novo Draft
                                </button>
                            </div>
                        </div>
                        <TournamentBracket state={tournament} />
                    </div>
                )}

                {phase === "FINISHED" && (
                    <EndScreen
                        isChampion={tournament.championTeamId === tournament.userTeamId}
                        userTeam={userTeam}
                        campaignStats={tournament.campaignStats}
                        onResetDraft={onResetDraft}
                    />
                )}
            </div>
        </div>
    );
}