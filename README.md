# Fable 5 Pinger 🛰️

A tiny browser widget that pings the `claude-fable-5` API endpoint every 2 minutes
and **plays a WW2 air-raid siren + fires confetti the moment it goes live**. It can
also **send you a WhatsApp message** headlessly, even with no tab open.

## Structure

- **`public/index.html`** — the widget. Polls `/api/check` every 2 minutes, shows a
  status light + countdown, loops `siren.mp3`, and rains confetti (until you stop the
  siren) when Fable 5 answers.
- **`public/siren.mp3`** — the siren (served statically, with range support).
- **`api/check.js`** — Vercel serverless function. Pings `claude-fable-5` server-side
  so the API key never reaches the browser. Used by the widget.
- **`api/cron.js`** — same check, plus a one-time WhatsApp alert when live. Triggered
  by a Vercel Cron Job (see `vercel.json`), so it works without a browser open.
- **`lib/checkEndpoint.js`** — shared check logic.
- **`lib/notify.js`** — Twilio WhatsApp send + Vercel KV / Upstash de-dupe.
- **`server.js`** — local dev server (serves `/api/check` and `/api/cron`).

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

This is a static site + serverless functions — no build step, no framework config.

1. Import the repo in Vercel (or `vercel` from the CLI).
2. Set `ANTHROPIC_KEY` in **Project → Settings → Environment Variables**, then redeploy.
3. Open the deployment URL, click **Arm siren & start**.

The key lives only in Vercel's env settings and your local `.env` — never in git.

## WhatsApp alerts

The cron (`/api/cron`) sends you a WhatsApp when `claude-fable-5` goes live — once,
even if no browser is open. It uses [Twilio](https://www.twilio.com/docs/whatsapp/quickstart).

1. **Create a Twilio account** and grab your **Account SID** and **Auth Token** from the
   console dashboard.
2. **Join the WhatsApp sandbox** (fastest path, no sender approval): **Messaging → Try it
   out → Send a WhatsApp message**. Send the given `join <code>` message from your phone to
   Twilio's sandbox number (`+1 415 523 8886`). Note: the sandbox drops you after 72h idle —
   re-send the join code to reconnect. For a permanent sender you'd register your own number.
3. **Set env vars** (`.env` locally, Project → Settings on Vercel):
   ```
   WHATSAPP_PHONE=+353...                     # your number (message recipient)
   TWILIO_ACCOUNT_SID=ACxxxxxxxx...
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 # sandbox sender (default); change for a real one
   ```
4. **Add a KV store for de-dupe.** In Vercel: **Storage → Create → KV** and connect it
   to the project. This auto-adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without a
   store the cron can't remember it already messaged you and will re-send every run
   (Fable 5 stays live once it's live).
5. Test it: `GET /api/cron?reset=1` clears the "already sent" flag so you can re-trigger.

### Cron frequency & Vercel plans

`vercel.json` schedules `/api/cron` every 2 minutes (`*/2 * * * *`). **Sub-daily crons
require the Vercel Pro plan** — on Hobby, cron jobs only run once a day. If you're on
Hobby, either upgrade, or point an external scheduler at
`https://<your-app>/api/cron` (e.g. cron-job.org at 1-min, UptimeRobot at 5-min). Set
`CRON_SECRET` and have the external caller send `Authorization: Bearer <secret>` to
keep the endpoint private.

## Notes

- The siren + confetti play only while the tab is open and the machine is awake.
  The **WhatsApp alert** is the headless path that reaches you when it's not.
- `▶ Test siren` toggles the siren on/off to confirm playback.
