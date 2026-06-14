"use client";

import React from "react";
import { useDraft } from "./DraftContext";
import { FootballField } from "./FootballField";
import { TeamSelectionArea } from "./TeamSelectionArea";
import { type DraftTeam } from "@/lib/draft";

interface DraftViewProps {
  onFinishDraft: (team: DraftTeam) => void;
}

export default function DraftView({
  onFinishDraft,
}: DraftViewProps) {
  const { currentTeam, pickedPlayers, step, isComplete, pickPlayer, resetDraft } = useDraft();

  const players = Object.values(pickedPlayers).filter(Boolean);

  const buildFinalTeam = (): DraftTeam => ({
    id: crypto.randomUUID(),
    name: "Draft Rebug FC",
    season: "Temporada 2026",
    logoUrl: "https://fvswzcifknoaietyekau.supabase.co/storage/v1/object/public/media/draft-teams/ebe42394-b3db-4e6e-9066-d4e9a3f7d82e.png",
    players: Object.values(pickedPlayers).filter(
      (p): p is NonNullable<typeof p> => Boolean(p)
    ),
  });

  const calculateOverall = () => {
    if (players.length === 0) return 0;
    const sum = players.reduce((acc, p) => acc + (p?.overall || 0), 0);
    return Math.round(sum / players.length);
  };

  // ==========================================
  // ESTADO: DRAFT FINALIZADO (MÁXIMA CONSISTÊNCIA VISUAL)
  // ==========================================
  if (isComplete) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8 animate-content-in">
        <div className="flex flex-col lg:flex-row gap-8 sm:gap-12 lg:gap-16 xl:gap-24">

          {/* Área Principal da Esquerda (Mesma largura da Fase de Draft) */}
          <div className="w-full lg:w-7/12 xl:w-8/12 space-y-6 sm:space-y-12">

            {/* Header Espelhado com Widget de Overall no lugar do Progresso */}
            <header className="flex flex-col md:flex-row justify-between items-stretch md:items-end gap-4 sm:gap-8">
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2.5 mb-2 sm:mb-4">
                  <span className="w-8 sm:w-10 h-1.5 bg-gold rounded-full shadow-[0_0_10px_rgba(255,179,0,0.5)]" />
                  <span className="text-[9px] sm:text-[10px] font-black text-gold uppercase tracking-[0.3em] sm:tracking-[0.4em]">Draft Finalizado</span>
                </div>
                <h1 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter text-white leading-tight">
                  Seu Elenco de Elite
                </h1>
                <p className="text-faint font-medium uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-[10px] mt-1">
                  Elenco pronto para dominar a <span className="text-gold">Federação Rebug</span>
                </p>
              </div>

              {/* Widget de Média Técnica (Substitui a caixinha de progresso mantendo o layout) */}
              <div className="bg-card/80 backdrop-blur-xl px-5 py-4 sm:px-8 sm:py-6 rounded-2xl sm:rounded-[2rem] border border-gold/30 flex items-center gap-4 sm:gap-8 shadow-2xl">
                <div className="space-y-0.5 shrink-0">
                  <div className="text-[8px] sm:text-[9px] font-black text-faint uppercase tracking-[0.2em] sm:tracking-[0.3em]">Média Geral</div>
                  <div className="text-2xl sm:text-4xl font-black text-gold italic leading-none">
                    {calculateOverall()}<span className="text-xs sm:text-sm text-white/40 ml-1 font-black not-italic">OVR</span>
                  </div>
                </div>
                <div className="flex-1 h-2 sm:h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 min-w-[120px] sm:min-w-[160px]">
                  <div
                    className="h-full bg-gradient-to-r from-gold to-yellow-400 shadow-[0_0_15px_rgba(255,179,0,0.4)]"
                    style={{ width: `${calculateOverall()}%` }}
                  />
                </div>
              </div>
            </header>

            {/* Painel de Controle de Ações de Conclusão */}
            <div className="bg-white/[0.02] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="text-white font-black uppercase text-xs sm:text-sm tracking-wider">Escalação Pronta</h3>
                <p className="text-faint text-[10px] sm:text-xs mt-0.5">Defina o rumo do campeonato ou recomece a triagem.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => onFinishDraft(buildFinalTeam())}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gold text-black font-black uppercase tracking-wider text-xs rounded-xl shadow-[0_10px_20px_rgba(255,179,0,0.15)] hover:bg-yellow-400 active:scale-95 transition-all text-center"
                >
                  Iniciar Torneio 🏆
                </button>
                <button
                  onClick={resetDraft}
                  className="w-full sm:w-auto px-5 py-3.5 border border-white/10 text-white/60 font-black uppercase tracking-wider text-xs rounded-xl hover:border-white/20 hover:text-white transition-all text-center"
                >
                  Refazer Draft
                </button>
              </div>
            </div>

            {/* Lista dos Selecionados no espaço central */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              {players.map((p, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center p-4 sm:p-6 bg-white/[0.03] rounded-2xl sm:rounded-3xl border border-white/5 hover:border-gold/30 hover:bg-white/[0.05] transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                    <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-black/40 flex items-center justify-center text-[10px] sm:text-xs font-black text-gold border border-white/10 shrink-0 group-hover:border-gold/50 transition-all">
                      {p!.position}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-black text-base sm:text-xl uppercase italic tracking-tight text-white group-hover:text-gold transition-colors truncate">
                        {p!.name}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-faint font-bold uppercase tracking-widest truncate">
                        {p!.teamName || "Lenda Histórica"}
                      </span>
                    </div>
                  </div>
                  <span className="text-white font-black text-2xl sm:text-4xl italic group-hover:scale-110 transition-transform pl-2 shrink-0">
                    {p!.overall}
                  </span>
                </div>
              ))}
            </div>

          </div>

          {/* Campo de Futebol (Exatamente no mesmo lugar e proporção da lateral direita) */}
          <div className="w-full lg:w-[450px] xl:w-[540px] lg:sticky lg:top-24 max-w-md mx-auto lg:max-w-none">
            <FootballField pickedPlayers={pickedPlayers} />
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // ESTADO: FASE DE DRAFT (ATIVO)
  // ==========================================
  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8 animate-content-in">
      <div className="flex flex-col lg:flex-row gap-8 sm:gap-12 lg:gap-16 xl:gap-24">

        {/* Área de Seleção */}
        <div className="w-full lg:w-7/12 xl:w-8/12 space-y-6 sm:space-y-12">

          {/* Header e Card de Progresso Responsivos */}
          <header className="flex flex-col md:flex-row justify-between items-stretch md:items-end gap-4 sm:gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2.5 mb-2 sm:mb-4">
                <span className="w-8 sm:w-10 h-1.5 bg-gold rounded-full shadow-[0_0_10px_rgba(255,179,0,0.5)]" />
                <span className="text-[9px] sm:text-[10px] font-black text-gold uppercase tracking-[0.3em] sm:tracking-[0.4em]">Fase de Draft</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black italic uppercase tracking-tighter text-white leading-tight">
                Draft Histórico
              </h1>
              <p className="text-faint font-medium uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-[10px] mt-1">
                Selecione uma lenda para cada <span className="text-gold">setor estratégico</span> do time
              </p>
            </div>

            {/* Bloco de Progresso Compactado para Mobile */}
            <div className="bg-card/80 backdrop-blur-xl px-5 py-4 sm:px-8 sm:py-6 rounded-2xl sm:rounded-[2rem] border border-white/10 flex items-center gap-4 sm:gap-8 shadow-2xl">
              <div className="space-y-0.5 shrink-0">
                <div className="text-[8px] sm:text-[9px] font-black text-faint uppercase tracking-[0.2em] sm:tracking-[0.3em]">Progresso</div>
                <div className="text-2xl sm:text-4xl font-black text-gold italic leading-none">
                  {step + 1}<span className="text-sm sm:text-lg text-white/20 mx-0.5">/</span>4
                </div>
              </div>
              <div className="flex-1 h-2 sm:h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 min-w-[120px] sm:min-w-[160px]">
                <div
                  className="h-full bg-gradient-to-r from-gold to-yellow-400 shadow-[0_0_15px_rgba(255,179,0,0.4)]"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
            </div>
          </header>

          {/* Grid de opções internas */}
          <div className="w-full">
            <TeamSelectionArea
              currentTeam={currentTeam}
              pickedPlayers={pickedPlayers}
              onPick={pickPlayer}
            />
          </div>

        </div>

        {/* Campo Adaptado (Lateral Direita) */}
        <div className="w-full lg:w-[450px] xl:w-[540px] lg:sticky lg:top-24 max-w-md mx-auto lg:max-w-none">
          <FootballField pickedPlayers={pickedPlayers} />
        </div>
      </div>
    </div>
  );
}