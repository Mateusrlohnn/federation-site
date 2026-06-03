import type { Match } from "@/lib/tournaments";

/** Tipos e estilos compartilhados entre a listagem e a tela da copa. */

export type TourTeam = { id: string; name: string; logo: string };

/** Dados de um torneio usados na listagem (cards). */
export type TournamentView = {
  id: string;
  name: string;
  status: string;
  banner: string;
  championTeamId: string | null;
  championName: string | null;
  teams: TourTeam[];
  matches: Match[];
  messages: { body: string }[];
};

export const statusStyle: Record<string, string> = {
  "Em andamento": "bg-gold text-[#1a1a1e]",
  Finalizado: "bg-win text-[#0a1f10]",
  "Em breve": "bg-draw text-white",
};
