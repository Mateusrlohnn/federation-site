"use client";

import React, { useState } from "react";
import DraftView from "@/components/draft/DraftView";
import { DraftProvider } from "@/components/draft/DraftContext";
import { TournamentCenter } from "@/components/draft/TournamentCenter";
import { type DraftTeam } from "@/lib/draft";

export function GameOrchestrator({
    initialTeams,
}: {
    initialTeams: DraftTeam[];
}) {
    const [appPhase, setAppPhase] = useState<"DRAFT" | "TOURNAMENT">("DRAFT");
    const [userTeam, setUserTeam] = useState<DraftTeam | null>(null);

    const handleStartTournament = (finalTeam: DraftTeam) => {
        setUserTeam(finalTeam);
        setAppPhase("TOURNAMENT");
    };

    const handleReset = () => {
        setUserTeam(null);
        setAppPhase("DRAFT");
    };

    return (
        <main className="min-h-screen">
            {appPhase === "DRAFT" && (
                <DraftProvider initialTeams={initialTeams}>
                    <DraftView onFinishDraft={handleStartTournament} />
                </DraftProvider>
            )}

            {appPhase === "TOURNAMENT" && userTeam && (
                <TournamentCenter
                    userTeam={userTeam}
                    iaTeams={initialTeams.filter((t) => t.id !== userTeam.id)}
                    onResetDraft={handleReset}
                />
            )}
        </main>
    );
}