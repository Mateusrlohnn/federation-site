"use client";

import React, { useMemo } from "react";
import { type DraftTeam } from "@/lib/draft";
import { type CampaignStats } from "@/lib/tournamentTypes";
import FifaCard from "@/components/players/FifaCard";
import Icon from "@/components/ui/Icon";

interface EndScreenProps {
    isChampion: boolean;
    userTeam: DraftTeam;
    campaignStats: CampaignStats;
    onResetDraft: () => void;
}

export function EndScreen({ isChampion, userTeam, campaignStats, onResetDraft }: EndScreenProps) {
    // REGRA #4: Leaderboards (Top 5)
    const topScorers = useMemo(() => {
        return Object.values(campaignStats?.playerStats || {})
            .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
            .slice(0, 5);
    }, [campaignStats]);

    const topAssisters = useMemo(() => {
        return Object.values(campaignStats?.playerStats || {})
            .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
            .slice(0, 5);
    }, [campaignStats]);

    const mvp = useMemo(() => {
        return Object.values(campaignStats?.playerStats || {})
            .sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists))[0];
    }, [campaignStats]);

    // Ordenação do Esquadrão Final (GK -> ZAG -> MID -> ATK)
    const orderedPlayers = useMemo(() => {
        const orderWeight: Record<string, number> = {
            GK: 1,
            ZAG: 2,
            MID: 3,
            ATK: 4
        };
        return [...userTeam.players].sort((a, b) => {
            const weightA = orderWeight[a.position.toUpperCase()] || 99;
            const weightB = orderWeight[b.position.toUpperCase()] || 99;
            return weightA - weightB;
        });
    }, [userTeam.players]);

    const history = campaignStats?.history || [];

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8 sm:space-y-12 pb-4 px-4 sm:px-0 animate-content-in">

            {/* Banner de Resultado */}
            <div className={`relative overflow-hidden p-6 sm:p-12 rounded-2xl sm:rounded-[3rem] border-2 text-center flex flex-col items-center justify-center min-h-[280px] sm:min-h-[350px] ${isChampion
                ? "bg-gradient-to-b from-gold/30 via-gold/5 to-transparent border-gold/30 shadow-[0_0_50px_rgba(255,179,0,0.1)]"
                : "bg-gradient-to-b from-white/5 to-transparent border-white/5"
                }`}>
                <div className={`text-6xl sm:text-8xl mb-4 sm:mb-6 transform transition-transform duration-1000 ${isChampion ? "animate-bounce" : "grayscale opacity-50"}`}>
                    {isChampion ? "🏆" : "🥈"}
                </div>
                <h1 className="text-4xl sm:text-7xl font-black tracking-tighter text-white uppercase italic leading-none mb-3 sm:mb-4">
                    {isChampion ? "Campeão!" : "Fim da Jornada"}
                </h1>
                <p className="text-faint max-w-xl text-sm sm:text-lg font-medium leading-relaxed">
                    {isChampion
                        ? "Você dominou o Rebug Draft e escreveu seu nome na galeria de lendas!"
                        : "Sua campanha chegou ao fim. O futebol é feito de glórias e cicatrizes."
                    }
                </p>
                {isChampion && mvp && (
                    <div className="mt-6 sm:mt-8 px-4 py-2.5 sm:px-6 sm:py-3 bg-gold/10 border border-gold/20 rounded-xl sm:rounded-2xl flex items-center gap-2.5 sm:gap-3 animate-content-in max-w-full">
                        <Icon name="trophy" className="text-gold w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                        <span className="text-gold font-black uppercase tracking-wider sm:tracking-widest text-[10px] sm:text-xs truncate">
                            MVP: {mvp.playerName} ({mvp.goals}G / {mvp.assists}A)
                        </span>
                    </div>
                )}
            </div>

            {/* Seu Elenco Final (Ordenado taticamente) */}
            <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-4 px-1 sm:px-2">
                    <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tight">Esquadrão Final</h2>
                    <div className="h-px flex-1 bg-white/10" />
                </div>
                {/* Modificado para grid-cols-2 no mobile mantendo sm:grid-cols-2 e lg:grid-cols-4 intactos */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
                    {orderedPlayers.map((player) => {
                        const stats = campaignStats?.playerStats?.[player.id] || { goals: 0, assists: 0 };
                        return (
                            <div key={player.id} className="flex flex-col items-center gap-3 sm:gap-4 group bg-white/[0.01] sm:bg-transparent p-2 sm:p-0 rounded-2xl border border-white/5 sm:border-none">
                                <div className="w-full max-w-[145px] sm:max-w-[220px] transition-transform group-hover:scale-105 duration-500">
                                    <FifaCard
                                        player={player.hofData}
                                        overall={player.overall}
                                        label=""
                                        isAuge={true}
                                        position={player.position}
                                        teamLogo={player.teamLogo}
                                        teamName={player.teamName}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full max-w-[140px] sm:max-w-[200px]">
                                    <div className="bg-white/5 border border-white/10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-center">
                                        <div className="text-[8px] sm:text-[10px] font-black text-gold uppercase tracking-wider sm:tracking-widest">Gols</div>
                                        <div className="text-sm sm:text-lg font-black text-white tabular-nums">{stats.goals}</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-center">
                                        <div className="text-[8px] sm:text-[10px] font-black text-gold uppercase tracking-wider sm:tracking-widest">Ast</div>
                                        <div className="text-sm sm:text-lg font-black text-white tabular-nums">{stats.assists}</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Rankings e Histórico */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10">
                {/* Leaderboards */}
                <div className="lg:col-span-5 space-y-6 sm:space-y-8">
                    <div className="bg-card border border-white/5 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-5 pointer-events-none">
                            <Icon name="futbol" className="w-20 h-20 sm:w-24 sm:h-24 text-white" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-white uppercase italic mb-4 sm:mb-6 flex items-center gap-2.5 sm:gap-3">
                            <span className="w-1.5 h-5 sm:h-6 bg-gold rounded-full" /> Top 5 Artilheiros
                        </h3>
                        <div className="space-y-1.5 sm:space-y-2">
                            {topScorers.map((p, i) => (
                                <div key={p.playerId} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                        <span className="text-[11px] sm:text-xs font-black text-faint w-4 sm:w-5 shrink-0">{i + 1}</span>
                                        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight truncate">{p.playerName}</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-gold tabular-nums shrink-0">{p.goals} Gols</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-card border border-white/5 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-5 pointer-events-none">
                            <Icon name="handshake-angle" className="w-20 h-20 sm:w-24 sm:h-24 text-white" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-white uppercase italic mb-4 sm:mb-6 flex items-center gap-2.5 sm:gap-3">
                            <span className="w-1.5 h-5 sm:h-6 bg-blue-400 rounded-full" /> Top 5 Garçons
                        </h3>
                        <div className="space-y-1.5 sm:space-y-2">
                            {topAssisters.map((p, i) => (
                                <div key={p.playerId} className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                        <span className="text-[11px] sm:text-xs font-black text-faint w-4 sm:w-5 shrink-0">{i + 1}</span>
                                        <span className="text-xs sm:text-sm font-bold text-white uppercase tracking-tight truncate">{p.playerName}</span>
                                    </div>
                                    <span className="text-xs sm:text-sm font-black text-blue-400 tabular-nums shrink-0">{p.assists} Ast</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Histórico da Campanha Timeline */}
                <div className="lg:col-span-7 space-y-4 sm:space-y-6">
                    <h3 className="text-xl sm:text-2xl font-black text-white uppercase italic px-1 sm:px-2">Histórico da Campanha</h3>
                    <div className="space-y-4 sm:space-y-6 relative before:absolute before:left-[15px] sm:before:left-[19px] before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                        {history.length === 0 ? (
                            <div className="pl-10 sm:pl-12 text-faint italic text-sm">Nenhuma partida registrada ainda.</div>
                        ) : (
                            history.map((h, i) => (
                                <div key={i} className="relative pl-10 sm:pl-12 animate-content-in">
                                    <div className={`absolute left-0 top-1 w-8 h-8 sm:w-10 sm:h-10 rounded-full border-4 border-[#0a0a0c] flex items-center justify-center z-10 ${h.result === 'win' ? "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                        }`}>
                                        <Icon name={h.result === 'win' ? "check" : "skull"} className="text-white w-3 h-3 sm:w-4 sm:h-4" />
                                    </div>
                                    <div className="bg-card border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl hover:border-white/10 transition-colors">
                                        <div className="flex flex-row items-center justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                                            <div className="min-w-0">
                                                <div className="text-[9px] sm:text-[10px] font-black text-gold uppercase tracking-widest mb-0.5">{h.stage}</div>
                                                <div className="text-base sm:text-xl font-black text-white uppercase tracking-tight truncate">vs {h.opponent}</div>
                                            </div>
                                            <div className="bg-black/40 px-4 py-1.5 sm:px-6 sm:py-2 rounded-xl sm:rounded-2xl border border-white/5 text-lg sm:text-2xl font-black text-white tracking-widest tabular-nums shrink-0">
                                                {h.score}
                                            </div>
                                        </div>
                                        {h.highlights.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
                                                {h.highlights.map((ev, idx) => (
                                                    <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-white/5 rounded-full border border-white/5">
                                                        <span className="text-[10px] sm:text-xs">{ev.type === 'GOAL' ? '⚽' : '🟥'}</span>
                                                        <span className="text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-tighter truncate max-w-[80px] sm:max-w-[100px]">{ev.playerName}</span>
                                                        <span className="text-[8px] sm:text-[9px] font-black text-faint">{ev.minute}'</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Footer / Reset */}
            <div className="flex flex-col items-center pt-6 sm:pt-10 border-t border-white/5">
                <button
                    onClick={onResetDraft}
                    className="group relative w-full sm:w-auto px-10 py-4 sm:py-6 bg-white hover:bg-gold text-black font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] rounded-xl sm:rounded-2xl shadow-2xl transition-all hover:scale-105 active:scale-95 text-xs sm:text-base flex items-center justify-center gap-3"
                >
                    <span className="relative z-10 flex items-center gap-3">
                        Novo Draft
                        <Icon name="rotate-right" className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-180 transition-transform duration-700" />
                    </span>
                </button>
            </div>
        </div>
    );
}