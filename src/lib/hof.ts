import raw from "@/data/hall-of-fame.json";
import { asPosition, type Position } from "@/lib/teams";

export type HofPlayer = {
  id?: string;
  name: string;
  nick: string; // conta do Hubbe (puxa o avatar); cai no name se vazio
  position: Position | null; // posição natural (opcional)
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
  // Cards estilo FIFA (preenchidos manualmente pelo admin) ----
  cardAugeOverall: number | null; // overall no auge (ex.: 88)
  cardAtualOverall: number | null; // overall atual (ex.: 87)
  aposentado: boolean; // true = card do auge vira branco "Icon"
  cardAugeTeamId: string | null; // time exibido no card do auge
  cardAtualTeamId: string | null; // time exibido no card atual
  cardAugePosition: Position | null; // posição no card do auge (cai na natural se nulo)
  cardAtualPosition: Position | null; // posição no card atual (cai na natural se nulo)
};

export type StatKey = Exclude<
  keyof HofPlayer,
  | "id"
  | "name"
  | "nick"
  | "points"
  | "position"
  | "cardAugeOverall"
  | "cardAtualOverall"
  | "aposentado"
  | "cardAugeTeamId"
  | "cardAtualTeamId"
  | "cardAugePosition"
  | "cardAtualPosition"
>;

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

/**
 * Jogadores que jogam sob outra conta do Hubbe — exibe o avatar dessa conta.
 * Chave em minúsculas (comparação case-insensitive).
 */
const AVATAR_OVERRIDES: Record<string, string> = {
  pegaso: "LebronGames",
  goenji: "Levi",
  deslocado: "Gabriel",
  "juninho pernanbucano": "Zico",
  ansaldi: "vrzada",
  plaay: "Beel",
  aduzn: "adu",
  protectedgod: "Modric",
};

export function avatarUrl(nick: string) {
  const key = (nick ?? "").trim();
  const account = AVATAR_OVERRIDES[key.toLowerCase()] ?? key;
  // Formato do gerador (hubbe.biz / Portal Duckets) — corpo inteiro (size=b).
  return `https://hubbe.biz/avatar/${encodeURIComponent(
    account,
  )}?action=std&direction=2&head_direction=2&gesture=std&size=b&headonly=0&img_format=png`;
}

/** Compute points from the weighted stats (mirrors the DB generated column). */
export function computePoints(p: Partial<Record<StatKey, number>>) {
  return STAT_FIELDS.reduce((sum, f) => sum + (Number(p[f.key]) || 0) * f.weight, 0);
}

/** Map a Supabase row (snake_case) to a HofPlayer. */
export function fromRow(r: Record<string, unknown>): HofPlayer {
  const p = {
    id: r.id as string,
    name: String(r.name),
    nick: (r.nick as string)?.trim() || String(r.name),
    position: asPosition(r.position),
    cardAugeOverall: r.card_auge_overall != null ? Number(r.card_auge_overall) : null,
    cardAtualOverall: r.card_atual_overall != null ? Number(r.card_atual_overall) : null,
    aposentado: Boolean(r.status_aposentado),
    cardAugeTeamId: (r.card_auge_team_id as string) ?? null,
    cardAtualTeamId: (r.card_atual_team_id as string) ?? null,
    cardAugePosition: asPosition(r.card_auge_position),
    cardAtualPosition: asPosition(r.card_atual_position),
  } as HofPlayer;
  for (const f of STAT_FIELDS) p[f.key] = Number(r[f.col]) || 0;
  p.points = r.points != null ? Number(r.points) : computePoints(p);
  return p;
}

/** Map a HofPlayer to a Supabase row (snake_case), excluding generated/id columns. */
export function toRow(p: HofPlayer): Record<string, string | number | boolean | null> {
  const r: Record<string, string | number | boolean | null> = {
    name: p.name.trim(),
    nick: (p.nick || p.name).trim(),
    position: p.position ?? null,
    card_auge_overall: p.cardAugeOverall ?? null,
    card_atual_overall: p.cardAtualOverall ?? null,
    status_aposentado: !!p.aposentado,
    card_auge_team_id: p.cardAugeTeamId ?? null,
    card_atual_team_id: p.cardAtualTeamId ?? null,
    card_auge_position: p.cardAugePosition ?? null,
    card_atual_position: p.cardAtualPosition ?? null,
  };
  for (const f of STAT_FIELDS) r[f.col] = Number(p[f.key]) || 0;
  return r;
}

/** Empty player for the "create" form. */
export function emptyPlayer(): HofPlayer {
  const p = {
    name: "",
    nick: "",
    position: null,
    points: 0,
    cardAugeOverall: null,
    cardAtualOverall: null,
    aposentado: false,
    cardAugeTeamId: null,
    cardAtualTeamId: null,
    cardAugePosition: null,
    cardAtualPosition: null,
  } as HofPlayer;
  for (const f of STAT_FIELDS) p[f.key] = 0;
  return p;
}

/** Bundled data used as fallback when Supabase isn't configured/reachable. */
export const fallbackPlayers: HofPlayer[] = (
  raw.players as Record<string, unknown>[]
).map((p) => {
  const o = {
    name: String(p.name),
    nick: (p.nick as string)?.trim() || String(p.name),
    position: asPosition(p.position),
    points: Number(p.points) || 0,
    cardAugeOverall: p.cardAugeOverall != null ? Number(p.cardAugeOverall) : null,
    cardAtualOverall: p.cardAtualOverall != null ? Number(p.cardAtualOverall) : null,
    aposentado: Boolean(p.aposentado),
    cardAugeTeamId: (p.cardAugeTeamId as string) ?? null,
    cardAtualTeamId: (p.cardAtualTeamId as string) ?? null,
    cardAugePosition: asPosition(p.cardAugePosition),
    cardAtualPosition: asPosition(p.cardAtualPosition),
  } as HofPlayer;
  for (const f of STAT_FIELDS) o[f.key] = Number(p[f.key]) || 0;
  return o;
});
