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
  rerollTeam: () => void;
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

      if (pickedPlayers[playerPos]) return;

      const isAlreadyPicked = Object.values(pickedPlayers).some(p => p?.id === player.id);
      if (isAlreadyPicked) return;

      const nextStep = step + 1;

      setPickedPlayers(prev => ({ ...prev, [playerPos]: player }));
      setStep(nextStep);

      if (nextStep < 4) {
        const available = initialTeams.filter(
          t => !usedTeamIds.includes(t.id) && (t as any).active !== false
        );
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

  const rerollTeam = useCallback(() => {
    if (step >= 4 || !currentTeam) return;

    const available = initialTeams.filter(
      t => !usedTeamIds.includes(t.id) && (t as any).active !== false
    );

    const pool = available.length > 0
      ? available
      : initialTeams.filter(t => (t as any).active !== false && t.id !== currentTeam.id);

    const finalPool = pool.length > 0 ? pool : initialTeams.filter(t => (t as any).active !== false);

    const nextTeam = pickRandom(finalPool);
    if (nextTeam) {
      setCurrentTeam(nextTeam);
      setUsedTeamIds(prev => [...prev, nextTeam.id]);
    }
  }, [currentTeam, step, usedTeamIds, initialTeams]);

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
      rerollTeam,
    }),
    [initialTeams, currentTeam, pickedPlayers, usedTeamIds, step, isComplete, pickPlayer, resetDraft, rerollTeam],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useDraft must be used within a DraftProvider");
  return context;
}