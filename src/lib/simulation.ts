import {
    type TournamentTeam,
    type MatchEvent,
    type TournamentPlayer
} from "./tournamentTypes";

export interface SimulationState {
    minute: number;
    scoreHome: number;
    scoreAway: number;
    events: MatchEvent[];
    isFinished: boolean;
    homePower: number;
    awayPower: number;
    homeRedCards: number;
    awayRedCards: number;
    // Rastreia amarelos por jogador (para segundo amarelo → vermelho)
    playerYellowCards: Record<string, number>;
    // Rastreia jogadores expulsos (não podem mais participar de nenhum evento)
    expelledPlayerIds: Set<string>;
}

export function createInitialSimulationState(homeTeam: TournamentTeam, awayTeam: TournamentTeam): SimulationState {
    return {
        minute: 0,
        scoreHome: 0,
        scoreAway: 0,
        events: [],
        isFinished: false,
        homePower: homeTeam.overall,
        awayPower: awayTeam.overall,
        homeRedCards: 0,
        awayRedCards: 0,
        playerYellowCards: {},
        expelledPlayerIds: new Set(),
    };
}

/** Retorna jogadores de campo elegíveis (não GK, não expulsos). */
function getFieldPlayers(
    team: TournamentTeam,
    expelledIds: Set<string>
): TournamentPlayer[] {
    return team.players.filter(p => p.position !== "GK" && !expelledIds.has(p.id));
}

/** Retorna jogadores elegíveis para levar cartão (qualquer posição, não expulsos). */
function getCardablePlayers(
    team: TournamentTeam,
    expelledIds: Set<string>
): TournamentPlayer[] {
    return team.players.filter(p => !expelledIds.has(p.id));
}

function pickRandom<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

export function tickSimulation(
    state: SimulationState,
    homeTeam: TournamentTeam,
    awayTeam: TournamentTeam
): SimulationState {
    if (state.isFinished) return state;

    const nextMinute = state.minute + 1;
    // Copia rasa do state; Set precisa ser recriado para ser imutável corretamente
    const newState: SimulationState = {
        ...state,
        minute: nextMinute,
        events: [...state.events],
        playerYellowCards: { ...state.playerYellowCards },
        // Mantém a mesma referência de Set enquanto não houver expulsão — se
        // houver expulsão, criamos um novo Set no bloco de cartão abaixo.
        expelledPlayerIds: state.expelledPlayerIds,
    };

    // ── Fim de jogo (minuto 90) ──────────────────────────────────────────────
    if (nextMinute >= 90) {
        newState.isFinished = true;

        if (newState.scoreHome === newState.scoreAway) {
            const winnerIsHome = Math.random() < newState.homePower / (newState.homePower + newState.awayPower);
            const team = winnerIsHome ? homeTeam : awayTeam;

            // BUG FIX: pênalti só pode ser cobrado por jogador de campo não expulso
            const eligible = getFieldPlayers(team, newState.expelledPlayerIds);
            const scorer = pickRandom(eligible) ?? pickRandom(team.players.filter(p => !newState.expelledPlayerIds.has(p.id)));

            if (scorer) {
                if (winnerIsHome) newState.scoreHome++; else newState.scoreAway++;
                newState.events.push({
                    minute: 90,
                    type: "GOAL",
                    teamId: team.id,
                    playerId: scorer.id,
                    playerName: `${scorer.name}`,
                });
            }
        }

        return newState;
    }

    // ── Evento aleatório (~6% de chance por minuto) ──────────────────────────
    if (Math.random() < 0.06) {
        const totalPower = newState.homePower + newState.awayPower;
        const isHomeEvent = Math.random() < newState.homePower / totalPower;
        const actingTeam = isHomeEvent ? homeTeam : awayTeam;
        const rand = Math.random();

        // ── GOL (45% dos eventos) ────────────────────────────────────────────
        if (rand < 0.45) {
            const isOwnGoal = Math.random() < 0.05;

            if (isOwnGoal) {
                // Gol contra: pode ser de qualquer jogador não expulso (inclusive GK)
                const eligible = getCardablePlayers(actingTeam, newState.expelledPlayerIds);
                const scorer = pickRandom(eligible);
                if (!scorer) return newState; // sem jogadores disponíveis, ignora evento

                if (isHomeEvent) newState.scoreAway++; else newState.scoreHome++;
                newState.events.push({
                    minute: nextMinute,
                    type: "OWN_GOAL",
                    teamId: actingTeam.id,
                    playerId: scorer.id,
                    playerName: scorer.name,
                });

            } else {
                // BUG FIX: gol normal — scorer deve ser jogador de CAMPO, não expulso
                const eligibleScorers = getFieldPlayers(actingTeam, newState.expelledPlayerIds);
                const scorer = pickRandom(eligibleScorers);
                if (!scorer) return newState; // time sem jogadores de campo disponíveis

                if (isHomeEvent) newState.scoreHome++; else newState.scoreAway++;

                // BUG FIX: assistência — jogador de campo, não expulso, diferente do scorer
                const possibleAssisters = eligibleScorers.filter(p => p.id !== scorer.id);
                const assist = Math.random() < 0.7 ? pickRandom(possibleAssisters) : undefined;

                newState.events.push({
                    minute: nextMinute,
                    type: "GOAL",
                    teamId: actingTeam.id,
                    playerId: scorer.id,
                    playerName: scorer.name,
                    assistPlayerId: assist?.id,
                    assistPlayerName: assist?.name,
                });
            }

            // ── CARTÃO ───────────────────────────────────────────────────────────
        } else {
            // BUG FIX: cartão só para jogadores ainda em campo (não expulsos)
            const cardable = getCardablePlayers(actingTeam, newState.expelledPlayerIds);
            const targetPlayer = pickRandom(cardable);
            if (!targetPlayer) return newState;

            const currentYellows = newState.playerYellowCards[targetPlayer.id] || 0;
            const isDirectRed = Math.random() >= 0.85;

            if (!isDirectRed && currentYellows === 0) {
                // Primeiro amarelo
                newState.playerYellowCards[targetPlayer.id] = 1;
                newState.events.push({
                    minute: nextMinute,
                    type: "YELLOW_CARD",
                    teamId: actingTeam.id,
                    playerId: targetPlayer.id,
                    playerName: targetPlayer.name,
                });

            } else if (!isDirectRed && currentYellows >= 1) {
                // Segundo amarelo → expulsão
                newState.playerYellowCards[targetPlayer.id] = 2;
                newState.expelledPlayerIds = new Set(newState.expelledPlayerIds).add(targetPlayer.id);
                if (isHomeEvent) { newState.homeRedCards++; newState.homePower *= 0.85; }
                else { newState.awayRedCards++; newState.awayPower *= 0.85; }
                newState.events.push({
                    minute: nextMinute,
                    type: "SECOND_YELLOW",
                    teamId: actingTeam.id,
                    playerId: targetPlayer.id,
                    playerName: targetPlayer.name,
                });

            } else {
                // Vermelho direto → expulsão
                newState.expelledPlayerIds = new Set(newState.expelledPlayerIds).add(targetPlayer.id);
                if (isHomeEvent) { newState.homeRedCards++; newState.homePower *= 0.85; }
                else { newState.awayRedCards++; newState.awayPower *= 0.85; }
                newState.events.push({
                    minute: nextMinute,
                    type: "RED_CARD",
                    teamId: actingTeam.id,
                    playerId: targetPlayer.id,
                    playerName: targetPlayer.name,
                });
            }
        }
    }

    return newState;
}

export function fastSimulate(homeTeam: TournamentTeam, awayTeam: TournamentTeam): SimulationState {
    let state = createInitialSimulationState(homeTeam, awayTeam);
    while (!state.isFinished) {
        state = tickSimulation(state, homeTeam, awayTeam);
    }
    return state;
}