# Picks Tracker

A static site showing whose NBA and NFL teams are winning. Use the dropdown at the top to switch leagues, or link straight to one with `?league=nfl`. Each team win counts as 1 point. If two people have the same points, the one with fewer losses ranks higher.

- `picks/<league>.json`: who picked which teams (names must match ESPN's names, e.g. "LA Clippers"). Keep people in the same order in every file so each person keeps their chart color.
- `scripts/update.mjs`: pulls standings and game results from ESPN's public API into `data/<league>/`
- `.github/workflows/update-standings.yml`: runs the script once a day at 09:37 UTC and commits the result. GitHub often runs it late, so until it has run, the page fetches any missing days from ESPN itself. Everyone always sees results through yesterday.
- `index.html`: the page
- `lib/espn.js`: ESPN helpers shared by the script and the page

## Run locally

```sh
node scripts/update.mjs
python -m http.server 8000   # then open http://localhost:8000
```

## Adding a league

Add it to `LEAGUES` in both `lib/espn.js` (ESPN sport path, e.g. `"hockey/nhl"`) and `index.html` (label and emoji), then create `picks/<league>.json`.

## Deploy (GitHub Pages)

1. Push this folder to a new GitHub repo.
2. In the repo, go to **Settings → Pages**. Set the source to **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Go to **Actions → Update standings → Run workflow** to check it works. After that it runs every morning on its own.
