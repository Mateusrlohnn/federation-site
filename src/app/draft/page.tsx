import { getDraftTeams } from "@/lib/draft";
import { GameOrchestrator } from "@/components/draft/GameOrchestrator";

export default async function DraftPage() {
    const teams = await getDraftTeams();

    return (
        <GameOrchestrator
            initialTeams={teams}
        />
    );
}