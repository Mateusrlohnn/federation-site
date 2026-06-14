"use client";

import React from "react";
import { type TournamentState, type MatchNode } from "@/lib/tournamentTypes";

interface TournamentBracketProps {
    state: TournamentState;
    onMatchClick?: (match: MatchNode) => void;
}

export function TournamentBracket({ state, onMatchClick }: TournamentBracketProps) {
    const renderMatch = (match: MatchNode) => {
        const isReady = match.status === "ready";
        const isFinished = match.status === "finished";

        const isUserInMatch = match.homeTeamId === state.userTeamId || match.awayTeamId === state.userTeamId;

        return (
            <div
                key={match.id}
                onClick={() => isReady && isUserInMatch && onMatchClick?.(match)}
                className={`
          flex flex-col w-full min-w-[180px] max-w-[240px] bg-card border-2 rounded-2xl overflow-hidden transition-all duration-300
          ${isReady && isUserInMatch ? "border-gold shadow-[0_0_20px_rgba(255,179,0,0.3)] cursor-pointer hover:scale-[1.03] active:scale-95 z-10" : "border-white/5"}
          ${isFinished ? "opacity-60 grayscale-[0.5]" : ""}
        `}
            >
                <div className="bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-faint flex justify-between items-center border-b border-white/5">
                    <span>{match.label}</span>
                    {isReady && isUserInMatch && <span className="text-gold animate-pulse">Sua Vez</span>}
                </div>

                <div className="p-3 space-y-2">
                    {/* Home Team */}
                    <div className={`flex justify-between items-center gap-3 ${match.winnerTeamId && match.winnerTeamId !== match.homeTeamId ? "opacity-30" : ""}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            {match.homeTeam?.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={match.homeTeam.logo}
                                    alt=""
                                    className="h-6 w-6 object-contain"
                                    onError={(e) => (e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E👤%3C/text%3E%3C/svg%3E")}
                                />
                            ) : (
                                <div className="h-6 w-6 flex items-center justify-center bg-white/5 rounded text-[10px]">👤</div>
                            )}
                            <span className={`text-xs font-black uppercase tracking-tighter truncate ${match.homeTeamId === state.userTeamId ? "text-gold" : "text-white"}`}>
                                {match.homeTeam?.name || "???"}
                            </span>
                        </div>
                        {isFinished && <span className="text-sm font-black text-white tabular-nums">{match.scoreHome}</span>}
                    </div>

                    {/* Away Team */}
                    <div className={`flex justify-between items-center gap-3 ${match.winnerTeamId && match.winnerTeamId !== match.awayTeamId ? "opacity-30" : ""}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            {match.awayTeam?.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={match.awayTeam.logo}
                                    alt=""
                                    className="h-6 w-6 object-contain"
                                    onError={(e) => (e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ctext y='20' font-size='20'%3E👤%3C/text%3E%3C/svg%3E")}
                                />
                            ) : (
                                <div className="h-6 w-6 flex items-center justify-center bg-white/5 rounded text-[10px]">👤</div>
                            )}
                            <span className={`text-xs font-black uppercase tracking-tighter truncate ${match.awayTeamId === state.userTeamId ? "text-gold" : "text-white"}`}>
                                {match.awayTeam?.name || "???"}
                            </span>
                        </div>
                        {isFinished && <span className="text-sm font-black text-white tabular-nums">{match.scoreAway}</span>}
                    </div>
                </div>
            </div>
        );
    };

    const uqf = state.upperBracket.filter(m => m.stage === 'UPPER_QF');
    const usf = state.upperBracket.filter(m => m.stage === 'UPPER_SF');
    const ufinal = state.upperBracket.filter(m => m.stage === 'UPPER_FINAL');

    const lr1 = state.lowerBracket.filter(m => m.stage === 'LOWER_R1');
    const lr2 = state.lowerBracket.filter(m => m.stage === 'LOWER_R2');
    const lsf = state.lowerBracket.filter(m => m.stage === 'LOWER_SF');
    const lfinal = state.lowerBracket.filter(m => m.stage === 'LOWER_FINAL');

    return (
        <div className="w-full space-y-20 py-10 overflow-x-auto custom-scrollbar">
            {/* Upper Bracket */}
            <div className="min-w-max">
                <h3 className="text-xs font-black text-gold uppercase tracking-[0.5em] mb-10 flex items-center gap-4">
                    <div className="w-12 h-px bg-gold/20" />
                    Upper Bracket
                </h3>
                <div className="flex gap-16 items-start px-4">
                    <div className="flex flex-col gap-8">{uqf.map(renderMatch)}</div>
                    <div className="flex flex-col gap-24 pt-12">{usf.map(renderMatch)}</div>
                    <div className="flex flex-col gap-24 pt-32">{ufinal.map(renderMatch)}</div>
                    <div className="flex flex-col pt-44">{renderMatch(state.grandFinal)}</div>
                </div>
            </div>

            {/* Lower Bracket */}
            <div className="min-w-max">
                <h3 className="text-xs font-black text-blue-400 uppercase tracking-[0.5em] mb-10 flex items-center gap-4">
                    <div className="w-12 h-px bg-blue-400/20" />
                    Lower Bracket
                </h3>
                <div className="flex gap-12 items-start px-4">
                    <div className="flex flex-col gap-8">{lr1.map(renderMatch)}</div>
                    <div className="flex flex-col gap-8">{lr2.map(renderMatch)}</div>
                    <div className="flex flex-col gap-8 pt-10">{lsf.map(renderMatch)}</div>
                    <div className="flex flex-col gap-8 pt-10">{lfinal.map(renderMatch)}</div>
                </div>
            </div>
        </div>
    );
}
