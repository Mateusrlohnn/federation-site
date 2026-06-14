export type Position = "GK" | "ZAG" | "MID" | "ATK";

export type MatchStage =
    | 'UPPER_QF' | 'UPPER_SF' | 'UPPER_FINAL'
    | 'LOWER_R1' | 'LOWER_R2' | 'LOWER_SF' | 'LOWER_FINAL'
    | 'GRAND_FINAL';

export type MatchStatus = 'scheduled' | 'pending' | 'ready' | 'simulating' | 'finished';

export type TournamentStatus = 'running' | 'finished';

export type MatchEventType =
    | 'GOAL'
    | 'ASSIST'
    | 'OWN_GOAL'
    | 'YELLOW_CARD'
    | 'RED_CARD'
    | 'SECOND_YELLOW'
    | 'MVP';

export interface TournamentPlayer {
    id: string;
    name: string;
    nick: string;
    position: Position;
    overall: number;
    avatar?: string;
    teamId?: string;
}

export interface TournamentTeam {
    id: string;
    name: string;
    logo?: string;
    isUser?: boolean;
    players: TournamentPlayer[];
    overall: number;
    power: number;
}

export interface MatchEvent {
    minute: number;
    type: MatchEventType;
    teamId: string;
    playerId: string;
    playerName: string;
    assistPlayerId?: string;
    assistPlayerName?: string;
}

export interface MatchNode {
    id: string;
    stage: MatchStage;
    label: string;
    homeTeamId?: string;
    awayTeamId?: string;
    homeTeam?: TournamentTeam;
    awayTeam?: TournamentTeam;
    scoreHome: number;
    scoreAway: number;
    winnerTeamId?: string;
    loserTeamId?: string;
    status: MatchStatus;
    isUserMatch: boolean;
    events: MatchEvent[];
}

export interface PlayerTournamentStats {
    playerId: string;
    playerName: string;
    goals: number;
    assists: number;
    yellowCards: number;
    redCards: number;
    ownGoals: number;
    mvps: number;
}

export interface UserCampaignHistory {
    stage: string;
    opponent: string;
    score: string;
    result: 'win' | 'loss';
    highlights: MatchEvent[];
}

export interface CampaignStats {
    goalsFor: number;
    goalsAgainst: number;
    wins: number;
    losses: number;
    playerStats: Record<string, PlayerTournamentStats>;
    history: UserCampaignHistory[];
}

export interface TournamentState {
    id: string;
    status: TournamentStatus;
    userTeamId: string;
    championTeamId?: string;
    upperBracket: MatchNode[];
    lowerBracket: MatchNode[];
    grandFinal: MatchNode;
    teams: TournamentTeam[];
    campaignStats: CampaignStats;
    createdAt: string;
}
