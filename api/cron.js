// Vercel serverless function: GET /api/cron
// Triggered by a Vercel Cron Job every 2 minutes (see vercel.json). Runs the
// same check as /api/check, then sends a one-time WhatsApp via Twilio when
// claude-fable-5 goes live. Works even with no browser tab open. Safe to call
// manually; add ?reset=1 to clear the "already notified" flag for testing.

const { checkEndpoint, MODEL } = require("../lib/checkEndpoint");
const { notifyIfLive, clearNotified } = require("../lib/notify");

module.exports = async (req, res) => {
  // If CRON_SECRET is set, require Vercel's cron auth header (Vercel sends it
  // automatically). Leave CRON_SECRET unset to allow unauthenticated calls.
  const secret = process.env.CRON_SECRET;
  if (secret && (req.headers.authorization || "") !== `Bearer ${secret}`) {
    res.status(401).json({ ok: false, reason: "unauthorized" });
    return;
  }

  if (/[?&]reset=1(&|$)/.test(req.url || "")) await clearNotified();

  const result = await checkEndpoint();
  const notify = await notifyIfLive(result);
  res.setHeader("cache-control", "no-store");
  res.status(200).json({ ...result, model: MODEL, notify, time: new Date().toISOString() });
};
