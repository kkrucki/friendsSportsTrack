// Fetches current NBA regular-season standings from ESPN and writes data/standings.json.
// Run with: node scripts/update.mjs   (Node 18+, no dependencies)
import { readFile, writeFile, mkdir } from "node:fs/promises";

const API_URL = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
const root = new URL("..", import.meta.url);

const res = await fetch(API_URL);
if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
const data = await res.json();

const teams = {};
for (const conference of data.children) {
  for (const entry of conference.standings.entries) {
    const stat = (name) => entry.stats.find((s) => s.name === name)?.value ?? 0;
    teams[entry.team.displayName] = {
      abbr: entry.team.abbreviation,
      logo: entry.team.logos?.[0]?.href ?? null,
      wins: stat("wins"),
      losses: stat("losses"),
    };
  }
}

// Fail loudly if a pick doesn't match an ESPN team name, so a typo never silently scores 0.
const picks = JSON.parse(await readFile(new URL("picks.json", root), "utf8"));
const unknown = Object.values(picks).flat().filter((name) => !teams[name]);
if (unknown.length) throw new Error(`Unknown team name(s) in picks.json: ${unknown.join(", ")}`);

await mkdir(new URL("data/", root), { recursive: true });
await writeFile(
  new URL("data/standings.json", root),
  JSON.stringify({ season: data.season?.displayName, updatedAt: new Date().toISOString(), teams }, null, 2) + "\n"
);
console.log(`Wrote standings for ${Object.keys(teams).length} teams`);

// Game-by-game results for the history chart. Cached in data/games.json; each run re-fetches
// the last cached day (in case a game finished late) through yesterday.
const SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard";
const gamesFile = new URL("data/games.json", root);
const etDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d); // YYYY-MM-DD
const addDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);

const regular = data.seasons.find((s) => s.year === data.season.year).types.find((t) => t.abbreviation === "reg");
const seasonStart = etDate(new Date(regular.startDate));
const seasonEnd = etDate(new Date(Date.parse(regular.endDate) - 1));

let cache = { season: data.season.displayName, throughDate: null, games: [] };
try {
  const existing = JSON.parse(await readFile(gamesFile, "utf8"));
  if (existing.season === cache.season) cache = existing;
} catch {}

const yesterday = addDays(etDate(new Date()), -1);
const last = yesterday < seasonEnd ? yesterday : seasonEnd;
const games = new Map(cache.games.map((g) => [g.id, g]));

for (let day = cache.throughDate ?? seasonStart; day <= last; day = addDays(day, 1)) {
  const r = await fetch(`${SCOREBOARD_URL}?dates=${day.replaceAll("-", "")}`);
  if (!r.ok) throw new Error(`ESPN scoreboard ${day} responded ${r.status}`);
  for (const event of (await r.json()).events) {
    const comp = event.competitions[0];
    if (event.season?.type !== 2 || !comp.status.type.completed) continue;
    const winner = comp.competitors.find((c) => c.winner);
    const loser = comp.competitors.find((c) => !c.winner);
    if (!winner || !loser) continue;
    games.set(event.id, { id: event.id, date: day, winner: winner.team.displayName, loser: loser.team.displayName });
  }
}

if (last >= seasonStart) cache.throughDate = last;
cache.games = [...games.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
await writeFile(gamesFile, JSON.stringify(cache, null, 2) + "\n");
console.log(`Wrote ${cache.games.length} games through ${cache.throughDate}`);
