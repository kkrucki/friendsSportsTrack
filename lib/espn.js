// ESPN helpers shared by scripts/update.mjs (Node) and index.html (browser).

export const LEAGUES = { nba: "basketball/nba", nfl: "football/nfl" };

export const etDate = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d); // YYYY-MM-DD
export const addDays = (iso, n) => new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export async function getJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} responded ${res.status}`);
  return res.json();
}

// NBA Cup round of a game ("group", "qf", "sf", "final"), or null for a regular game.
// ESPN marks Cup games with a note like "NBA Cup - Quarterfinals"; the final has type "CC".
function cupRound(comp) {
  const note = comp.notes?.map((n) => n.headline ?? "").find((h) => h.startsWith("NBA Cup"));
  if (comp.type?.abbreviation === "CC" || /Championship/.test(note)) return "final";
  if (!note) return null;
  if (/Semifinal/.test(note)) return "sf";
  if (/Quarterfinal/.test(note)) return "qf";
  return "group";
}

// Completed regular-season games from fromDay through toDay (inclusive, ET dates), one request per day.
export async function fetchGames(path, fromDay, toDay, init) {
  const games = [];
  for (let day = fromDay; day <= toDay; day = addDays(day, 1)) {
    const board = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${day.replaceAll("-", "")}`, init);
    for (const event of board.events) {
      const comp = event.competitions[0];
      if (event.season?.type !== 2 || !comp.status.type.completed) continue;
      const cup = cupRound(comp);
      games.push({
        id: event.id,
        date: day,
        teams: comp.competitors.map((c) => c.team.displayName),
        winner: comp.competitors.find((c) => c.winner)?.team.displayName ?? null, // null = tie
        ...(cup && { cup }),
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

// A win is worth 1 point; NBA Cup wins are worth more each round.
export const CUP_POINTS = { group: 2, qf: 3, sf: 4, final: 5 };
export const pointsFor = (game, team) => (game.winner === team ? (CUP_POINTS[game.cup] ?? 1) : 0);

// The Cup final earns points but, as in the NBA standings, isn't part of W–L records.
export const countsInRecord = (game) => game.cup !== "final";

export function recordsFromGames(games) {
  const records = {};
  for (const g of games) {
    for (const team of g.teams) {
      const r = (records[team] ??= { wins: 0, losses: 0, ties: 0, cupWins: 0, points: 0 });
      if (countsInRecord(g)) r[g.winner === null ? "ties" : g.winner === team ? "wins" : "losses"]++;
      if (g.cup && g.winner === team) r.cupWins++;
      r.points += pointsFor(g, team);
    }
  }
  return records;
}
