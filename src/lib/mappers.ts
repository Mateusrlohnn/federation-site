import { type DraftTeam, type DraftPlayer } from "./draft";
import { type TournamentTeam, type TournamentPlayer, type Position } from "./tournamentTypes";

export function mapDraftPlayerToTournament(p: DraftPlayer): TournamentPlayer {
    return {
        id: p.id,
        name: p.name,
        position: p.position as Position,
        overall: p.overall,
        avatar: p.avatar,
    };
}

export function mapDraftTeamToTournament(t: DraftTeam, isUser: boolean = false): TournamentTeam {
    const players = t.players.map(mapDraftPlayerToTournament);

    const overall = Math.round(players.reduce((acc, p) => acc + p.overall, 0) / players.length) || 0;

    return {
        id: t.id,
        name: t.name,
        logo: t.logoUrl,
        isUser,
        players,
        overall,
        power: overall, // Inicia com o overall médio
    };
}
