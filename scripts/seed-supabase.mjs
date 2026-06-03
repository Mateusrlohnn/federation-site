// Loads the imported Hall of Fame players into Supabase.
// Prerequisites:
//   1) .env.local filled with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   2) supabase/schema.sql already run in the Supabase SQL editor
// Run:  node scripts/seed-supabase.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// minimal .env.local loader (no extra deps)
const envPath = fileURLToPath(new URL("../.env.local", import.meta.url));
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) process.env[m[1]] ??= m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const dataPath = fileURLToPath(new URL("../src/data/hall-of-fame.json", import.meta.url));
const { players } = JSON.parse(readFileSync(dataPath, "utf8"));

const rows = players.map((p) => ({
  name: p.name,
  titles: p.titles,
  runner_ups: p.runnerUps,
  mvp: p.mvp,
  top1: p.top1,
  top2: p.top2,
  top3: p.top3,
  titles_academy: p.titlesAcademy,
  mvp_academy: p.mvpAcademy,
  runner_ups_academy: p.runnerUpsAcademy,
  t1_academy: p.t1Academy,
  t2_academy: p.t2Academy,
  t3_academy: p.t3Academy,
}));

const { error, count } = await supabase
  .from("players")
  .upsert(rows, { onConflict: "name", count: "exact" });

if (error) {
  console.error("Seed failed:", error.message);
  process.exit(1);
}
console.log(`Seeded ${count ?? rows.length} players into Supabase.`);
