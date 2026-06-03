import PlayersView from "@/components/players/PlayersView";
import { fallbackPlayers, fromRow, type HofPlayer } from "@/lib/hof";
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

export default async function PlayersPage() {
  const players = await getPlayers();
  return <PlayersView players={players} />;
}
