// ESPN helpers shared by scripts/update.mjs (Node) and index.html (browser).

export const LEAGUES = { nba: "basketball/nba", nfl: "football/nfl" };

export const etDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d); // YYYY-MM-DD
export const addDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

// Completed regular-season games from fromDay through toDay (inclusive, ET dates), one request per day.
export async function fetchGames(path, fromDay, toDay, init) {
  const games = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const board = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${day.replaceAll("-", "")}`, init);
    for (const event of board.events) {
      const comp = event.competitions[0];
      if (event.season?.type !== 2 || !comp.status.type.completed) continue;
      games.push({
        id: event.id,
        date: day,
        teams: comp.competitors.map((c) => c.team.displayName),
        winner: comp.competitors.find((c) => c.winner)?.team.displayName ?? null, // null = tie
      });
    }
  }
  return games;
}

export function mergeGames(existing, fresh) {
  const byId = new Map(existing.map((g) => [g.id, g]));
  for (const g of fresh) byId.set(g.id, g);
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

export function recordsFromGames(games) {
  const records = {};
  for (const g of games) {
    for (const team of g.teams) {
      const r = (records[team] ??= { wins: 0, losses: 0, ties: 0 });
      r[g.winner === null ? "ties" : g.winner === team ? "wins" : "losses"]++;
    }
  }
  return records;
}
