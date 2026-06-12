"use client";

import React from "react";
import { type Position } from "@/lib/teams";
import { type DraftTeam, type DraftPlayer, type DraftSelection } from "@/lib/draft";
import FifaCard from "@/components/players/FifaCard";

interface TeamSelectionAreaProps {
  currentTeam: DraftTeam | null;
  pickedPlayers: DraftSelection;
  onPick: (player: DraftPlayer) => void;
}

const POSITIONS_ORDER: Position[] = ["GK", "ZAG", "MID", "ATK"];

export function TeamSelectionArea({
  currentTeam,
  pickedPlayers,
  onPick,
}: TeamSelectionAreaProps) {
  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-48 rounded-2xl border-2 border-dashed border-white/5 text-faint text-xs font-black uppercase tracking-widest">
        Buscando novos talentos…
      </div>
    );
  }

  const alreadyPickedIds = new Set(
    Object.values(pickedPlayers)
      .filter(Boolean)
      .map((p) => p!.id),
  );

  return (
    <div className="flex flex-col gap-8 w-full animate-content-in">
      {/* Time Sorteado Header */}
      <div className="bg-card p-8 rounded-[2rem] border border-white/5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-3xl rounded-full" />

        <div className="relative z-10 flex items-center gap-6">
          <div className="w-16 h-16 bg-white/5 rounded-2xl p-3 border border-white/10 flex items-center justify-center">
            {currentTeam.logoUrl ? (
              <img src={currentTeam.logoUrl} alt="" className="w-full h-full object-contain drop-shadow-lg" />
            ) : (
              <span className="text-2xl">🛡️</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-black text-gold uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-gold/10 border border-gold/20">
                Time Histórico
              </span>
              <span className="text-[9px] font-black text-faint uppercase tracking-[0.2em]">
                {currentTeam.season}
              </span>
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase">
              {currentTeam.name}
            </h2>
          </div>
        </div>

        <div className="relative z-10 flex flex-col md:items-end">
          <span className="text-[9px] font-black text-faint uppercase tracking-[0.3em] mb-1">
            Status do Draft
          </span>
          <div className="flex items-center gap-2">
            {POSITIONS_ORDER.map(pos => (
              <div
                key={pos}
                className={`text-[10px] font-black px-2 py-1 rounded border transition-all ${pickedPlayers[pos]
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : "bg-white/5 border-white/10 text-white/20"
                  }`}
              >
                {pos}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Jogadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 justify-items-center">
        {currentTeam.players.map((player) => {
          const isAlreadyPicked = alreadyPickedIds.has(player.id);
          const isPositionFilled = !!pickedPlayers[player.position];
          const isDisabled = isAlreadyPicked || isPositionFilled;

          return (
            <button
              key={player.id}
              onClick={() => !isDisabled && onPick(player)}
              disabled={isDisabled}
              className={`relative flex flex-col items-center w-full max-w-[200px] transition-all duration-500 group
                ${isDisabled ? "opacity-40 grayscale cursor-not-allowed scale-95" : "hover:scale-[1.05] active:scale-95 cursor-pointer"}
              `}
            >
              {/* Badge: Já Selecionado */}
              {isAlreadyPicked && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-gold text-black text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-2xl border border-black/10 animate-bounce-in">
                  Já Selecionado
                </div>
              )}

              {/* Tag: Posição Ocupada */}
              {isPositionFilled && !isAlreadyPicked && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-black/90 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl border border-white/10 whitespace-nowrap tracking-widest shadow-2xl scale-0 group-hover:scale-100 transition-transform pointer-events-none">
                  {player.position} Ocupado
                </div>
              )}

              <div className="w-full transition-transform duration-300 group-hover:scale-[1.04]">
                <FifaCard
                  player={player.hofData}
                  overall={player.overall}
                  label=""
                  isAuge={true}
                  position={player.position}
                  teamLogo={currentTeam.logoUrl}
                  teamName={currentTeam.name}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
