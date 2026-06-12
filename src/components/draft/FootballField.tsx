"use client";

import React from "react";
import { type Position } from "@/lib/teams";
import { type DraftSelection } from "@/lib/draft";
import FifaCard from "@/components/players/FifaCard";

interface FootballFieldProps {
  pickedPlayers: DraftSelection;
}

export function FootballField({ pickedPlayers }: FootballFieldProps) {
  const positions: Position[] = ["ATK", "MID", "ZAG", "GK"];

  return (
    <div className="relative w-full aspect-[9/16] bg-panel/30 rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
      {/* Field Lines (Simplified & Elegant) */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-white rounded-full" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-16 border border-white border-t-0 rounded-b-xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-16 border border-white border-b-0 rounded-t-xl" />
      </div>

      {/* Grass subtle texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, #fff 40px, #fff 80px)' }} />

      {/* Players */}
      <div className="relative h-full flex flex-col justify-around py-4 px-4">
        {positions.map((pos) => {
          const player = pickedPlayers[pos];
          return (
            <div key={pos} className="flex justify-center items-center h-1/4 w-full">
              {player ? (
                /* Box com tamanho controlado para encaixar perfeitamente nas linhas do campo */
                <div className="w-24 sm:w-28 md:w-32 transition-all duration-300 transform hover:scale-110 drop-shadow-2xl">
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
              ) : (
                <div className="w-16 h-20 sm:w-20 sm:h-26 border border-dashed border-white/10 bg-white/5 rounded-lg flex items-center justify-center transition-colors hover:border-white/20 shadow-inner">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-faint">
                    {pos}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}