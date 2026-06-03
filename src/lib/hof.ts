import raw from "@/data/hall-of-fame.json";

export type HofPlayer = {
  id?: string;
  name: string;
  titles: number;
  runnerUps: number;
  mvp: number;
  top1: number;
  top2: number;
  top3: number;
  titlesAcademy: number;
  mvpAcademy: number;
  runnerUpsAcademy: number;
  t1Academy: number;
  t2Academy: number;
  t3Academy: number;
  points: number;
};

export type StatKey = Exclude<keyof HofPlayer, "id" | "name" | "points">;

/** Single source of truth: app field <-> DB column <-> scoring weight. */
export const STAT_FIELDS: { key: StatKey; col: string; label: string; weight: number }[] = [
  { key: "titles", col: "titles", label: "Títulos", weight: 100 },
  { key: "runnerUps", col: "runner_ups", label: "Vices", weight: 30 },
  { key: "mvp", col: "mvp", label: "MVP", weight: 50 },
  { key: "top1", col: "top1", label: "Top 1", weight: 40 },
  { key: "top2", col: "top2", label: "Top 2", weight: 20 },
  { key: "top3", col: "top3", label: "Top 3", weight: 10 },
  { key: "titlesAcademy", col: "titles_academy", label: "Títulos Academy", weight: 10 },
  { key: "mvpAcademy", col: "mvp_academy", label: "MVP Academy", weight: 8 },
  { key: "runnerUpsAcademy", col: "runner_ups_academy", label: "Vices Academy", weight: 5 },
  { key: "t1Academy", col: "t1_academy", label: "Top 1 Academy", weight: 7 },
  { key: "t2Academy", col: "t2_academy", label: "Top 2 Academy", weight: 3 },
  { key: "t3Academy", col: "t3_academy", label: "Top 3 Academy", weight: 1 },
];

export function avatarUrl(name: string) {
  return `https://hubbe.biz/avatar/${encodeURIComponent(name)}.png`;
}

/** Compute points from the weighted stats (mirrors the DB generated column). */
export function computePoints(p: Partial<Record<StatKey, number>>) {
  return STAT_FIELDS.reduce((sum, f) => sum + (Number(p[f.key]) || 0) * f.weight, 0);
}

/** Map a Supabase row (snake_case) to a HofPlayer. */
export function fromRow(r: Record<string, unknown>): HofPlayer {
  const p = { id: r.id as string, name: String(r.name) } as HofPlayer;
  for (const f of STAT_FIELDS) p[f.key] = Number(r[f.col]) || 0;
  p.points = r.points != null ? Number(r.points) : computePoints(p);
  return p;
}

/** Map a HofPlayer to a Supabase row (snake_case), excluding generated/id columns. */
export function toRow(p: HofPlayer): Record<string, string | number> {
  const r: Record<string, string | number> = { name: p.name.trim() };
  for (const f of STAT_FIELDS) r[f.col] = Number(p[f.key]) || 0;
  return r;
}

/** Empty player for the "create" form. */
export function emptyPlayer(): HofPlayer {
  const p = { name: "", points: 0 } as HofPlayer;
  for (const f of STAT_FIELDS) p[f.key] = 0;
  return p;
}

/** Bundled data used as fallback when Supabase isn't configured/reachable. */
export const fallbackPlayers: HofPlayer[] = (
  raw.players as Record<string, unknown>[]
).map((p) => {
  const o = { name: String(p.name), points: Number(p.points) || 0 } as HofPlayer;
  for (const f of STAT_FIELDS) o[f.key] = Number(p[f.key]) || 0;
  return o;
});
