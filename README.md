# Fable 5 Pinger 🛰️

A tiny zero-dependency browser widget that pings the `claude-fable-5` API endpoint
every 10 minutes and **plays a WW2 air-raid siren the moment it goes live**.

## How it works

- **`server.js`** — a dependency-free Node server (port `5757`). It loads
  `ANTHROPIC_KEY` from `.env` and exposes `/check`, which pings `claude-fable-5`
  server-side (so your API key never reaches the browser). It classifies the
  response as `working` (200), `not_available` (404 / model-not-found), or an error.
  It also serves `siren.mp3` with HTTP range support.
- **`index.html`** — the widget. Polls `/check` every 10 minutes, shows a status
  light + countdown, and loops `siren.mp3` when Fable 5 answers.

## Setup

1. Copy `.env.example` to `.env` and add your Anthropic key:
   ```
   ANTHROPIC_KEY=sk-ant-...
   ```
2. Start the server (Node 18+ required for built-in `fetch`):
   ```
   node server.js
   ```
3. Open http://localhost:5757
4. Click **Arm siren & start** once (browsers block audio until a click), then
   leave the tab open.

## Notes

- The siren plays only while the tab is open and the machine is awake.
- `▶ Test siren` toggles the siren on/off so you can confirm your `siren.mp3` works.
