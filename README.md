# AMKRO Racing website

Static site (no build step) for the AMKRO sim racing team, modelled on the layout of OhnyFans.

## Run locally
Open `index.html` in a browser, or rgun `python3 -m http.server` in this folder.

## Customise
All team content lives at the top of `script.js` (race schedule, glossary, drivers, timeline, FAQ, quotes, gallery).
Replace the placeholder social links in `index.html`. Drop real images into an `images/` folder and swap the gallery placeholders.

## Deploy with GitHub Pages
Push these files to the repo root, then Settings → Pages → Deploy from branch → `main` / root.

## Automatic data (GitHub Actions)
`.github/workflows/update-data.yml` runs every 30 minutes and:
- logs in to WorldSimSeries Paddock with Playwright (`scripts/update_events.py`) and writes `data/events.json`
- reads the YouTube "videos only" feed (no Shorts) and writes `data/youtube.json` (`scripts/update_youtube.py`)

Add two repository secrets under Settings → Secrets and variables → Actions: `WSS_EMAIL` and `WSS_PASSWORD`.
Instagram cannot be read automatically: edit `data/instagram.json` after each post.

## Discord reminders and standings
- `scripts/discord_alerts.py` runs after each event scrape and posts a Discord embed when a race starts within 50 minutes (state in `data/sent_alerts.json`). Add the secret `DISCORD_WEBHOOK_URL`. If you keep this, switch off the old WSS-BOT-V3 workflow, otherwise every race is announced twice.
- `.github/workflows/update-standings.yml` runs every 3 hours, scrapes current and finished events plus each event's standings page into `data/standings.json`.
