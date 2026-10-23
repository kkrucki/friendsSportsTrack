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
