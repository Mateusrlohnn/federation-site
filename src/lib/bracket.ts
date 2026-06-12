import {
    type TournamentTeam,
    type MatchNode,
    type TournamentState,
    type MatchStage,
} from "./tournamentTypes";

function createMatch(id: string, stage: MatchStage, label: string): MatchNode {
    return {
        id,
        stage,
        label,
        scoreHome: 0,
        scoreAway: 0,
        status: "scheduled",
        isUserMatch: false,
        events: []
    };
}

export function createTournament(teams: TournamentTeam[], userTeamId: string): TournamentState {
    if (teams.length !== 8) {
        throw new Error("Double Elimination requer exatamente 8 times.");
    }

    const shuffled = [...teams].sort(() => Math.random() - 0.5);

    const upperBracket: MatchNode[] = [
        createMatch("UB1", "UPPER_QF", "Upper Quarterfinal 1"),
        createMatch("UB2", "UPPER_QF", "Upper Quarterfinal 2"),
        createMatch("UB3", "UPPER_QF", "Upper Quarterfinal 3"),
        createMatch("UB4", "UPPER_QF", "Upper Quarterfinal 4"),

        createMatch("UB5", "UPPER_SF", "Upper Semifinal 1"),
        createMatch("UB6", "UPPER_SF", "Upper Semifinal 2"),

        createMatch("UB7", "UPPER_FINAL", "Upper Final"),
    ];

    upperBracket[0].homeTeam = shuffled[0]; upperBracket[0].homeTeamId = shuffled[0].id;
    upperBracket[0].awayTeam = shuffled[1]; upperBracket[0].awayTeamId = shuffled[1].id;

    upperBracket[1].homeTeam = shuffled[2]; upperBracket[1].homeTeamId = shuffled[2].id;
    upperBracket[1].awayTeam = shuffled[3]; upperBracket[1].awayTeamId = shuffled[3].id;

    upperBracket[2].homeTeam = shuffled[4]; upperBracket[2].homeTeamId = shuffled[4].id;
    upperBracket[2].awayTeam = shuffled[5]; upperBracket[2].awayTeamId = shuffled[5].id;

    upperBracket[3].homeTeam = shuffled[6]; upperBracket[3].homeTeamId = shuffled[6].id;
    upperBracket[3].awayTeam = shuffled[7]; upperBracket[3].awayTeamId = shuffled[7].id;

    for (let i = 0; i < 4; i++) {
        upperBracket[i].status = "ready";
    }

    const lowerBracket: MatchNode[] = [
        createMatch("LB1", "LOWER_R1", "Lower Round 1"),
        createMatch("LB2", "LOWER_R1", "Lower Round 1"),

        createMatch("LB3", "LOWER_R2", "Lower Round 2"),
        createMatch("LB4", "LOWER_R2", "Lower Round 2"),

        createMatch("LB5", "LOWER_SF", "Lower Semifinal"),
        createMatch("LB6", "LOWER_FINAL", "Lower Final"),
    ];

    const grandFinal = createMatch("GF1", "GRAND_FINAL", "Grand Final");

    const state: TournamentState = {
        id: crypto.randomUUID(),
        status: "running",
        userTeamId,
        teams,
        upperBracket,
        lowerBracket,
        grandFinal,
        // BUG FIX #1: history estava faltando no estado inicial, causando
        // runtime error no EndScreen e no updateCampaignStats.
        campaignStats: {
            goalsFor: 0,
            goalsAgainst: 0,
            wins: 0,
            losses: 0,
            playerStats: {},
            history: [],
        },
        createdAt: new Date().toISOString(),
    };

    [...state.upperBracket, ...state.lowerBracket, state.grandFinal].forEach(m => {
        if (m.homeTeamId === userTeamId || m.awayTeamId === userTeamId) {
            m.isUserMatch = true;
        }
    });

    return state;
}