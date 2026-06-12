"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { type DraftTeam, type DraftPlayer, type DraftSelection } from "@/lib/draft";

interface DraftContextType {
  teams: DraftTeam[];
  currentTeam: DraftTeam | null;
  pickedPlayers: DraftSelection;
  usedTeamIds: string[];
  step: number;
  isComplete: boolean;
  pickPlayer: (player: DraftPlayer) => void;
  resetDraft: () => void;
}

const DraftContext = createContext<DraftContextType | undefined>(undefined);

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickFirstTeam(teams: DraftTeam[]): { team: DraftTeam; usedIds: string[] } | null {
  const available = teams.filter(t => (t as any).active !== false);
  const team = pickRandom(available);
  if (!team) return null;
  return { team, usedIds: [team.id] };
}

export function DraftProvider({
  children,
  initialTeams,
}: {
  children: React.ReactNode;
  initialTeams: DraftTeam[];
}) {
  const [pickedPlayers, setPickedPlayers] = useState<DraftSelection>({});
  const [usedTeamIds, setUsedTeamIds] = useState<string[]>([]);
  const [currentTeam, setCurrentTeam] = useState<DraftTeam | null>(null);
  const [step, setStep] = useState(0);

  // BUG FIX #8: O ref de controle anterior era manipulado de forma confusa no
  // resetDraft (setando false e logo em seguida true de forma síncrona, sem o
  // useEffect realmente re-executar entre os dois sets). Simplificado: o ref só
  // serve para garantir que o roll inicial roda uma única vez na montagem.
  const initialRollDone = useRef(false);

  useEffect(() => {
    if (initialTeams.length > 0 && !initialRollDone.current) {
      initialRollDone.current = true;
      const result = pickFirstTeam(initialTeams);
      if (result) {
        setCurrentTeam(result.team);
        setUsedTeamIds(result.usedIds);
      }
    }
  }, [initialTeams]);

  const pickPlayer = useCallback(
    (player: DraftPlayer) => {
      if (step >= 4) return;

      const playerPos = player.position;

      // Posição já preenchida
      if (pickedPlayers[playerPos]) return;

      // Unicidade por ID
      const isAlreadyPicked = Object.values(pickedPlayers).some(p => p?.id === player.id);
      if (isAlreadyPicked) return;

      const nextStep = step + 1;

      setPickedPlayers(prev => ({ ...prev, [playerPos]: player }));
      setStep(nextStep);

      if (nextStep < 4) {
        // Rola próximo time sem repetir
        const available = initialTeams.filter(
          t => !usedTeamIds.includes(t.id) && (t as any).active !== false
        );
        // Se esgotou os times únicos, repete o pool completo
        const pool = available.length > 0 ? available : initialTeams.filter(t => (t as any).active !== false);
        const nextTeam = pickRandom(pool);
        if (nextTeam) {
          setCurrentTeam(nextTeam);
          setUsedTeamIds(prev => [...prev, nextTeam.id]);
        }
      }
    },
    [pickedPlayers, step, usedTeamIds, initialTeams],
  );

  // BUG FIX #9: resetDraft agora faz tudo de forma direta e síncrona sem
  // precisar resetar o ref (que não serve para nada no reset, pois o useEffect
  // de montagem não re-executa depois do primeiro render de qualquer forma).
  const resetDraft = useCallback(() => {
    setPickedPlayers({});
    setStep(0);

    const result = pickFirstTeam(initialTeams);
    if (result) {
      setCurrentTeam(result.team);
      setUsedTeamIds(result.usedIds);
    } else {
      setCurrentTeam(null);
      setUsedTeamIds([]);
    }
  }, [initialTeams]);

  const isComplete = step === 4;

  const value = useMemo(
    () => ({
      teams: initialTeams,
      currentTeam,
      pickedPlayers,
      usedTeamIds,
      step,
      isComplete,
      pickPlayer,
      resetDraft,
    }),
    [initialTeams, currentTeam, pickedPlayers, usedTeamIds, step, isComplete, pickPlayer, resetDraft],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useDraft must be used within a DraftProvider");
  return context;
}