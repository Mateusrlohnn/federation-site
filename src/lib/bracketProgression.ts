import {
    type MatchNode,
    type TournamentState,
    type TournamentTeam,
} from "./tournamentTypes";
import { fastSimulate } from "./simulation";

function setTeamInMatch(match: MatchNode, teamId: string, isHome?: boolean) {
    if (isHome === true) {
        match.homeTeamId = teamId;
    } else if (isHome === false) {
        match.awayTeamId = teamId;
    } else {
        if (!match.homeTeamId) {
            match.homeTeamId = teamId;
        } else {
            match.awayTeamId = teamId;
        }
    }
}

function activateMatch(match: MatchNode, teams: TournamentTeam[], userTeamId: string) {
    if (match.status === "finished") return;

    if (match.homeTeamId && match.awayTeamId) {
        match.homeTeam = teams.find(t => t.id === match.homeTeamId);
        match.awayTeam = teams.find(t => t.id === match.awayTeamId);
        match.status = "ready";
        match.isUserMatch = match.homeTeamId === userTeamId || match.awayTeamId === userTeamId;
    } else {
        match.status = "pending";
    }
}

function getMatch(tournament: TournamentState, matchId: string): MatchNode {
    const match = [
        ...tournament.upperBracket,
        ...tournament.lowerBracket,
        tournament.grandFinal,
    ].find((m) => m.id === matchId);
    if (!match) throw new Error(`Match ${matchId} not found.`);
    return match;
}

function updateCampaignStats(tournament: TournamentState, match: MatchNode) {
    // BUG FIX #2: Garante inicialização defensiva completa, incluindo history,
    // para cobrir o caso de states antigos/serializados sem o campo.
    if (!tournament.campaignStats) {
        tournament.campaignStats = {
            goalsFor: 0,
            goalsAgainst: 0,
            wins: 0,
            losses: 0,
            playerStats: {},
            history: [],
        };
    }
    if (!tournament.campaignStats.history) {
        tournament.campaignStats.history = [];
    }

    const stats = tournament.campaignStats;
    const isUserHome = match.homeTeamId === tournament.userTeamId;
    const isUserAway = match.awayTeamId === tournament.userTeamId;

    // Registra no histórico APENAS partidas do usuário
    if (isUserHome || isUserAway) {
        const userScore = isUserHome ? match.scoreHome : match.scoreAway;
        const oppScore = isUserHome ? match.scoreAway : match.scoreHome;
        const oppName = isUserHome ? match.awayTeam?.name : match.homeTeam?.name;
        const result = match.winnerTeamId === tournament.userTeamId ? "win" : "loss";

        if (result === "win") stats.wins++; else stats.losses++;
        stats.goalsFor += userScore;
        stats.goalsAgainst += oppScore;

        // BUG FIX #3: Filtra highlights apenas de gols/cartões vermelhos para
        // não poluir a timeline com cartões amarelos e outros eventos menores.
        stats.history.push({
            stage: match.label,
            opponent: oppName || "???",
            score: `${userScore} - ${oppScore}`,
            result,
            highlights: match.events.filter(
                e => e.type === "GOAL" || e.type === "OWN_GOAL" || e.type === "RED_CARD" || e.type === "SECOND_YELLOW"
            ),
        });
    }

    // Atualiza estatísticas individuais de TODOS os jogadores envolvidos
    match.events.forEach(event => {
        // CORREÇÃO: Cria uma chave composta combinando o Time + Jogador
        const statsKey = `${event.teamId}_${event.playerId}`;

        const ensurePlayer = (id: string, name: string, teamId: string) => {
            const key = `${teamId}_${id}`;
            if (!stats.playerStats[key]) {
                stats.playerStats[key] = {
                    playerId: id,
                    playerName: name,
                    goals: 0,
                    assists: 0,
                    yellowCards: 0,
                    redCards: 0,
                    ownGoals: 0,
                    mvps: 0,
                };
            }
        };

        if (event.type === "GOAL") {
            ensurePlayer(event.playerId, event.playerName, event.teamId);
            stats.playerStats[statsKey].goals++;

            if (event.assistPlayerId && event.assistPlayerName) {
                const assistKey = `${event.teamId}_${event.assistPlayerId}`;
                ensurePlayer(event.assistPlayerId, event.assistPlayerName, event.teamId);
                stats.playerStats[assistKey].assists++;
            }
        } else if (event.type === "OWN_GOAL") {
            ensurePlayer(event.playerId, event.playerName, event.teamId);
            stats.playerStats[statsKey].ownGoals++;
        } else if (event.type === "YELLOW_CARD") {
            ensurePlayer(event.playerId, event.playerName, event.teamId);
            stats.playerStats[statsKey].yellowCards++;
        } else if (event.type === "RED_CARD" || event.type === "SECOND_YELLOW") {
            ensurePlayer(event.playerId, event.playerName, event.teamId);
            stats.playerStats[statsKey].redCards++;
        }
    });
}

export function advanceBracket(
    tournament: TournamentState,
    matchId: string,
    winnerId: string,
    loserId: string,
    scoreHome: number,
    scoreAway: number,
    events: MatchNode["events"]
): TournamentState {
    const clone: TournamentState = structuredClone(tournament);
    const match = getMatch(clone, matchId);

    match.winnerTeamId = winnerId;
    match.loserTeamId = loserId;
    match.scoreHome = scoreHome;
    match.scoreAway = scoreAway;
    match.events = events;
    match.status = "finished";

    updateCampaignStats(clone, match);

    switch (matchId) {
        case "UB1":
            setTeamInMatch(getMatch(clone, "UB5"), winnerId, true);
            setTeamInMatch(getMatch(clone, "LB1"), loserId, true);
            break;
        case "UB2":
            setTeamInMatch(getMatch(clone, "UB5"), winnerId, false);
            setTeamInMatch(getMatch(clone, "LB1"), loserId, false);
            break;
        case "UB3":
            setTeamInMatch(getMatch(clone, "UB6"), winnerId, true);
            setTeamInMatch(getMatch(clone, "LB2"), loserId, true);
            break;
        case "UB4":
            setTeamInMatch(getMatch(clone, "UB6"), winnerId, false);
            setTeamInMatch(getMatch(clone, "LB2"), loserId, false);
            break;
        case "UB5":
            setTeamInMatch(getMatch(clone, "UB7"), winnerId, true);
            setTeamInMatch(getMatch(clone, "LB4"), loserId, false);
            break;
        case "UB6":
            setTeamInMatch(getMatch(clone, "UB7"), winnerId, false);
            setTeamInMatch(getMatch(clone, "LB3"), loserId, false);
            break;
        case "UB7":
            setTeamInMatch(getMatch(clone, "GF1"), winnerId, true);
            setTeamInMatch(getMatch(clone, "LB6"), loserId, false);
            break;
        case "LB1": setTeamInMatch(getMatch(clone, "LB3"), winnerId, true); break;
        case "LB2": setTeamInMatch(getMatch(clone, "LB4"), winnerId, true); break;
        case "LB3": setTeamInMatch(getMatch(clone, "LB5"), winnerId, true); break;
        case "LB4": setTeamInMatch(getMatch(clone, "LB5"), winnerId, false); break;
        case "LB5": setTeamInMatch(getMatch(clone, "LB6"), winnerId, true); break;
        case "LB6": setTeamInMatch(getMatch(clone, "GF1"), winnerId, false); break;
        case "GF1":
            clone.championTeamId = winnerId;
            clone.status = "finished";
            break;
    }

    [...clone.upperBracket, ...clone.lowerBracket, clone.grandFinal].forEach(m =>
        activateMatch(m, clone.teams, clone.userTeamId)
    );

    return clone;
}

export function autoSimulateAIMatches(tournament: TournamentState): TournamentState {
    let current = structuredClone(tournament);
    let changed = true;
    while (changed) {
        changed = false;
        const readyMatch = [...current.upperBracket, ...current.lowerBracket, current.grandFinal]
            .find(m => m.status === "ready" && !m.isUserMatch);
        if (readyMatch) {
            const sim = fastSimulate(readyMatch.homeTeam!, readyMatch.awayTeam!);
            const winnerId = sim.scoreHome >= sim.scoreAway ? readyMatch.homeTeamId! : readyMatch.awayTeamId!;
            const loserId = sim.scoreHome >= sim.scoreAway ? readyMatch.awayTeamId! : readyMatch.homeTeamId!;
            current = advanceBracket(current, readyMatch.id, winnerId, loserId, sim.scoreHome, sim.scoreAway, sim.events);
            changed = true;
        }
    }
    return current;
}

// BUG FIX #4: Lógica anterior só checava Lower Bracket, então um usuário
// eliminado na Grand Final (perdendo a única partida da GF) nunca era detectado.
// A lógica correta é: o usuário foi eliminado se há uma partida finalizada onde
// ele é o loserTeamId E não existe nenhuma partida futura (ready/pending/scheduled)
// que ele seja participante.
export function hasUserBeenEliminated(tournament: TournamentState): boolean {
    const allMatches = [
        ...tournament.upperBracket,
        ...tournament.lowerBracket,
        tournament.grandFinal,
    ];

    // Se o torneio já terminou com um campeão diferente do usuário, ele foi eliminado
    if (tournament.status === "finished" && tournament.championTeamId !== tournament.userTeamId) {
        return true;
    }

    const isLoserInAnyMatch = allMatches.some(
        m => m.status === "finished" && m.loserTeamId === tournament.userTeamId
    );

    if (!isLoserInAnyMatch) return false;

    // Verifica se ainda há partida futura para o usuário (ele pode ter sofrido
    // uma derrota no Upper e ainda estar vivo na Lower)
    const hasActiveFutureMatch = allMatches.some(
        m =>
            m.status !== "finished" &&
            (m.homeTeamId === tournament.userTeamId || m.awayTeamId === tournament.userTeamId)
    );

    return !hasActiveFutureMatch;
}