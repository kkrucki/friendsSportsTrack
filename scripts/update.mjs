// Fetches current regular-season standings and game results from ESPN for each league,
// writing data/<league>/standings.json and data/<league>/games.json.
// Run with: node scripts/update.mjs   (Node 18+, no dependencies)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { LEAGUES, etDate, addDays, getJson, fetchGames, mergeGames } from "../lib/espn.js";

const root = new URL("..", import.meta.url);

for (const [league, path] of Object.entries(LEAGUES)) {
  const dir = new URL(`data/${league}/`, root);
  const data = await getJson(`https://site.api.espn.com/apis/v2/sports/${path}/standings`);

  const teams = {};
  for (const conference of data.children) {
    for (const entry of conference.standings.entries) {
      const stat = (name) => entry.stats.find((s) => s.name === name)?.value ?? 0;
      teams[entry.team.displayName] = {
        abbr: entry.team.abbreviation,
        logo: entry.team.logos?.[0]?.href ?? null,
        wins: stat("wins"),
        losses: stat("losses"),
        ties: stat("ties"),
      };
    }
  }

  // Fail loudly if a pick doesn't match an ESPN team name, so a typo never silently scores 0.
  const picks = JSON.parse(await readFile(new URL(`picks/${league}.json`, root), "utf8"));
  const unknown = Object.values(picks).flat().filter((name) => !teams[name]);
  if (unknown.length) throw new Error(`Unknown team name(s) in picks/${league}.json: ${unknown.join(", ")}`);

  await mkdir(dir, { recursive: true });
  await writeFile(
    new URL("standings.json", dir),
    JSON.stringify({ season: data.season?.displayName, updatedAt: new Date().toISOString(), teams }, null, 2) + "\n"
  );
  console.log(`${league}: wrote standings for ${Object.keys(teams).length} teams`);

  // Game-by-game results for the history chart. Cached in games.json; each run re-fetches
  // the last cached day (in case a game finished late) through yesterday.
  const gamesFile = new URL("games.json", dir);
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
  cache.games = mergeGames(cache.games, await fetchGames(path, cache.throughDate ?? seasonStart, last));
  if (last >= seasonStart) cache.throughDate = last;
  await writeFile(gamesFile, JSON.stringify(cache, null, 2) + "\n");
  console.log(`${league}: wrote ${cache.games.length} games through ${cache.throughDate}`);
}
