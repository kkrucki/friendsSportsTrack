# NBA Picks Tracker

A static site showing whose NBA teams are winning. Each team win counts as 1 point. If two people have the same points, the one with fewer losses ranks higher.

- `picks.json`: who picked which teams (names must match ESPN's names, e.g. "LA Clippers")
- `scripts/update.mjs`: pulls standings from ESPN's public API into `data/standings.json`
- `.github/workflows/update-standings.yml`: runs the script every day at 10:00 UTC and commits the result
- `index.html`: the page

## Run locally

```sh
node scripts/update.mjs
python -m http.server 8000   # then open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Push this folder to a new GitHub repo.
2. In the repo, go to **Settings → Pages**. Set the source to **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Go to **Actions → Update standings → Run workflow** to check it works. After that it runs every morning on its own.
