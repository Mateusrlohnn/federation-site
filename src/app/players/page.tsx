import PlayersView from "@/components/players/PlayersView";
import { fallbackPlayers, fromRow, type HofPlayer } from "@/lib/hof";
import {
  matchFromRow,
  computePlayerCupStats,
  type PlayerCupStats,
} from "@/lib/tournaments";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";

// Always read fresh from the database so admin edits appear immediately.
export const dynamic = "force-dynamic";

async function getPlayers(): Promise<HofPlayer[]> {
  if (!supabaseConfigured) return fallbackPlayers;
  try {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("points", { ascending: false });
    if (error || !data) return fallbackPlayers;
    return data.map(fromRow);
  } catch {
    return fallbackPlayers;
  }
}

// Agrega gols/assistências/clean sheets/partidas de todas as súmulas por jogador.
async function getCupStats(): Promise<Record<string, PlayerCupStats>> {
  if (!supabaseConfigured) return {};
  try {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id, home_team_id, away_team_id, home_score, away_score, is_live, scheduled, match_events(player_id, team_id, type, minute, secondary_player_id), match_lineups(player_id, team_id, position, is_starter, rating)",
      )
      .eq("is_live", false)
      .eq("scheduled", false);
    if (error || !data) return {};
    const stats = computePlayerCupStats(data.map(matchFromRow));
    return Object.fromEntries(stats);
  } catch {
    return {};
  }
}

export default async function PlayersPage() {
  const [players, cupStats] = await Promise.all([getPlayers(), getCupStats()]);
  return <PlayersView players={players} cupStats={cupStats} />;
}
