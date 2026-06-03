// Imports "Hall of Fame.xlsx" into src/data/hall-of-fame.json
// Re-run whenever the spreadsheet changes:  node scripts/import-hall-of-fame.mjs
import { read, utils } from "xlsx";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const xlsxPath = fileURLToPath(new URL("../data-source/Hall of Fame.xlsx", import.meta.url));
const outPath = fileURLToPath(new URL("../src/data/hall-of-fame.json", import.meta.url));

const WEIGHTS = {
  titles: 100,
  runnerUps: 30,
  mvp: 50,
  top1: 40,
  top2: 20,
  top3: 10,
  titlesAcademy: 10,
  mvpAcademy: 8,
  runnerUpsAcademy: 5,
  t1Academy: 7,
  t2Academy: 3,
  t3Academy: 1,
};

// column index -> field
const COLS = {
  rank: 0,
  name: 1,
  titles: 2,
  runnerUps: 3,
  mvp: 4,
  top1: 5,
  top2: 6,
  top3: 7,
  titlesAcademy: 8,
  mvpAcademy: 9,
  runnerUpsAcademy: 10,
  t1Academy: 11,
  t2Academy: 12,
  t3Academy: 13,
  points: 14,
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const wb = read(readFileSync(xlsxPath), { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = utils.sheet_to_json(ws, { header: 1, defval: "" }).slice(1); // drop header

const players = rows
  .filter((r) => String(r[COLS.name]).trim() !== "")
  .map((r) => {
    const p = {
      name: String(r[COLS.name]).trim(),
      titles: num(r[COLS.titles]),
      runnerUps: num(r[COLS.runnerUps]),
      mvp: num(r[COLS.mvp]),
      top1: num(r[COLS.top1]),
      top2: num(r[COLS.top2]),
      top3: num(r[COLS.top3]),
      titlesAcademy: num(r[COLS.titlesAcademy]),
      mvpAcademy: num(r[COLS.mvpAcademy]),
      runnerUpsAcademy: num(r[COLS.runnerUpsAcademy]),
      t1Academy: num(r[COLS.t1Academy]),
      t2Academy: num(r[COLS.t2Academy]),
      t3Academy: num(r[COLS.t3Academy]),
    };
    const computed = Object.entries(WEIGHTS).reduce((sum, [k, w]) => sum + p[k] * w, 0);
    const sheetPoints = num(r[COLS.points]);
    return { ...p, points: sheetPoints || computed, computedPoints: computed };
  })
  .sort((a, b) => b.points - a.points);

// sanity check: warn if computed != sheet points
const mismatches = players.filter((p) => p.points !== p.computedPoints);
writeFileSync(outPath, JSON.stringify({ weights: WEIGHTS, players }, null, 2));

console.log(`Imported ${players.length} players -> ${outPath}`);
if (mismatches.length) {
  console.log(`\n${mismatches.length} players where sheet points != computed points:`);
  mismatches.slice(0, 10).forEach((p) =>
    console.log(`  ${p.name}: sheet=${p.points} computed=${p.computedPoints}`),
  );
}
