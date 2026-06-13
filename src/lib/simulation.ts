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
    // Titulares definidos no início da partida para não mudarem no meio do jogo
    homeStarters: TournamentPlayer[];
    awayStarters: TournamentPlayer[];
}

/** Função utilitária para embaralhar arrays (Fisher-Yates) */
function shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Sorteia os 4 titulares que vão iniciar a partida: 1 GK, 1 ZAG, 1 MID e 1 ATK */
export function selectRandomStarters(team: TournamentTeam): TournamentPlayer[] {
    const starters: TournamentPlayer[] = [];

    // Filtra e embaralha os jogadores por cada posição específica
    const gks = shuffleArray(team.players.filter(p => p.position === "GK"));
    const zags = shuffleArray(team.players.filter(p => p.position === "ZAG"));
    const mids = shuffleArray(team.players.filter(p => p.position === "MID"));
    const atks = shuffleArray(team.players.filter(p => p.position === "ATK"));

    // Pega exatamente 1 jogador de cada posição (se houver)
    if (gks.length > 0) starters.push(gks[0]);
    if (zags.length > 0) starters.push(zags[0]);
    if (mids.length > 0) starters.push(mids[0]);
    if (atks.length > 0) starters.push(atks[0]);

    // Fallback de segurança: se o time não tiver alguma das posições cadastradas,
    // completa com os jogadores que sobraram para garantir 4 em campo.
    if (starters.length < 4) {
        const starterIds = new Set(starters.map(p => p.id));
        const remainingPlayers = shuffleArray(team.players.filter(p => !starterIds.has(p.id)));
        const needed = 4 - starters.length;
        starters.push(...remainingPlayers.slice(0, needed));
    }

    return starters.slice(0, 4);
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
        // Define os titulares uma única vez por partida
        homeStarters: selectRandomStarters(homeTeam),
        awayStarters: selectRandomStarters(awayTeam),
    };
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

    const newState: SimulationState = {
        ...state,
        minute: nextMinute,
        events: [...state.events],
        playerYellowCards: { ...state.playerYellowCards },
        expelledPlayerIds: state.expelledPlayerIds,
        // Mantém a referência dos titulares
        homeStarters: state.homeStarters,
        awayStarters: state.awayStarters,
    };

    // ── Fim de jogo (minuto 90) ──────────────────────────────────────────────
    if (nextMinute >= 90) {
        newState.isFinished = true;

        if (newState.scoreHome === newState.scoreAway) {
            const winnerIsHome = Math.random() < newState.homePower / (newState.homePower + newState.awayPower);
            const team = winnerIsHome ? homeTeam : awayTeam;
            const teamStarters = winnerIsHome ? newState.homeStarters : newState.awayStarters;

            // Gol de Ouro: jogador de campo não expulso entre os titulares
            const eligible = teamStarters.filter(p => p.position !== "GK" && !newState.expelledPlayerIds.has(p.id));
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
        const actingStarters = isHomeEvent ? newState.homeStarters : newState.awayStarters;

        const rand = Math.random();

        // ── GOL (45% dos eventos) ────────────────────────────────────────────
        if (rand < 0.45) {
            const isOwnGoal = Math.random() < 0.05;

            if (isOwnGoal) {
                const eligible = actingStarters.filter(p => !newState.expelledPlayerIds.has(p.id));
                const scorer = pickRandom(eligible);
                if (!scorer) return newState;

                if (isHomeEvent) newState.scoreAway++; else newState.scoreHome++;
                newState.events.push({
                    minute: nextMinute,
                    type: "OWN_GOAL",
                    teamId: actingTeam.id,
                    playerId: scorer.id,
                    playerName: scorer.name,
                });

            } else {
                const eligibleScorers = actingStarters.filter(p => p.position !== "GK" && !newState.expelledPlayerIds.has(p.id));
                const scorer = pickRandom(eligibleScorers);
                if (!scorer) return newState;

                if (isHomeEvent) newState.scoreHome++; else newState.scoreAway++;

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

            // ── CARTÃO (Reduzido para 20% dos eventos) ───────────────────────────
        } else if (rand < 0.65) {
            const cardable = actingStarters.filter(p => !newState.expelledPlayerIds.has(p.id));
            const targetPlayer = pickRandom(cardable);
            if (!targetPlayer) return newState;

            const currentYellows = newState.playerYellowCards[targetPlayer.id] || 0;
            const isDirectRed = Math.random() >= 0.95;

            if (!isDirectRed && currentYellows === 0) {
                newState.playerYellowCards[targetPlayer.id] = 1;
                newState.events.push({
                    minute: nextMinute,
                    type: "YELLOW_CARD",
                    teamId: actingTeam.id,
                    playerId: targetPlayer.id,
                    playerName: targetPlayer.name,
                });

            } else if (!isDirectRed && currentYellows >= 1) {
                if (Math.random() < 0.30) {
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
                }

            } else {
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
        // Se o rand for >= 0.65, nenhum evento relevante acontece (ex: chute pra fora)
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