# Fable 5 Pinger 🛰️

A tiny browser widget that pings the `claude-fable-5` API endpoint every 10 minutes
and **plays a WW2 air-raid siren the moment it goes live**.

## Structure

- **`public/index.html`** — the widget. Polls `/api/check` every 10 minutes, shows a
  status light + countdown, and loops `siren.mp3` when Fable 5 answers.
- **`public/siren.mp3`** — the siren (served statically, with range support).
- **`api/check.js`** — Vercel serverless function. Pings `claude-fable-5` server-side
  so the API key never reaches the browser.
- **`lib/checkEndpoint.js`** — shared check logic used by the function and local server.
- **`server.js`** — local dev server (not used on Vercel).

## Run locally

1. Copy `.env.example` to `.env` and add your key:
   ```
   ANTHROPIC_KEY=sk-ant-...
   ```
2. Start it (Node 18+ for built-in `fetch`):
   ```
   node server.js
   ```
3. Open http://localhost:5757, click **Arm siren & start**, leave the tab open.

## Deploy to Vercel

This is a static site + serverless function — no build step, no framework config.

1. Import the repo in Vercel (or `vercel` from the CLI).
2. Set the environment variable in **Project → Settings → Environment Variables**:
   ```
   ANTHROPIC_KEY = sk-ant-...
   ```
   (Production, and Preview if you want preview deploys to work.) Then redeploy.
3. Open the deployment URL, click **Arm siren & start**.

The key lives only in Vercel's env settings and your local `.env` — never in git.

## Notes

- The siren plays only while the tab is open and the machine is awake. Vercel won't
  ping on its own — that would need a Cron job + push notifications.
- `▶ Test siren` toggles the siren on/off to confirm playback.
