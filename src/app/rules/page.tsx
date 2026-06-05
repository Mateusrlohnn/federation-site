import RulesView, { type RuleSection } from "@/components/rules/RulesView";
import { publicClient, supabaseConfigured } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

async function getSections(): Promise<RuleSection[]> {
  if (!supabaseConfigured) return [];
  try {
    const supabase = publicClient();
    const { data, error } = await supabase
      .from("rules_sections")
      .select("title, content, sort_order")
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data.map((r) => ({ title: String(r.title), content: String(r.content ?? "") }));
  } catch {
    return [];
  }
}

export default async function RulesPage() {
  const sections = await getSections();
  return <RulesView sections={sections} />;
}
