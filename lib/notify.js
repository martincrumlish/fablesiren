// WhatsApp notification + de-dupe for the headless cron path.
//
// - Sends a WhatsApp message to your own number via the Twilio API:
//   https://www.twilio.com/docs/whatsapp/quickstart
// - Remembers "already notified" in a Vercel KV / Upstash Redis store so the
//   every-2-minute cron doesn't re-send once claude-fable-5 is live (it stays
//   live forever, so without this you'd get a message every run).
//
// Everything uses plain `fetch` (no npm dependencies, like the rest of the
// project) and degrades gracefully when its env vars are missing.

const NOTIFY_KEY = "fable5_notified";

function kvConfigured() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function kvHeaders() {
  return { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` };
}

async function kvGet(key) {
  if (!kvConfigured()) return null;
  try {
    const res = await fetch(`${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: kvHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  if (!kvConfigured()) return false;
  try {
    const res = await fetch(
      `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
      { headers: kvHeaders() }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function clearNotified() {
  if (!kvConfigured()) return false;
  try {
    const res = await fetch(`${process.env.KV_REST_API_URL}/del/${encodeURIComponent(NOTIFY_KEY)}`, {
      headers: kvHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendWhatsApp(text) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const to = process.env.WHATSAPP_PHONE;
  // Defaults to Twilio's shared WhatsApp sandbox sender.
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  if (!sid || !token || !to) return { sent: false, reason: "whatsapp_not_configured" };

  const waTo = "whatsapp:" + to.replace(/^whatsapp:/, "").trim();
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  // Freeform Body only works within 24h of your last inbound WhatsApp message
  // (e.g. right after joining the sandbox). For an alert that may fire days
  // later, set TWILIO_CONTENT_SID to an approved template — those send any time.
  const params = { From: from, To: waTo };
  if (process.env.TWILIO_CONTENT_SID) {
    params.ContentSid = process.env.TWILIO_CONTENT_SID;
    if (process.env.TWILIO_CONTENT_VARS) params.ContentVariables = process.env.TWILIO_CONTENT_VARS;
  } else {
    params.Body = text;
  }
  const body = new URLSearchParams(params);
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
        body,
      }
    );
    const detail = await res.text().catch(() => "");
    return { sent: res.ok, status: res.status, detail: detail.slice(0, 200) };
  } catch (e) {
    return { sent: false, reason: "network_error", detail: e.message };
  }
}

// Given a checkEndpoint() result, send a one-time WhatsApp when live.
async function notifyIfLive(result) {
  if (!result || !result.working) return { notified: false, reason: "not_live" };

  if (await kvGet(NOTIFY_KEY)) return { notified: false, reason: "already_notified" };

  const msg = ("🚨 claude-fable-5 is LIVE! " + (result.detail || "")).trim();
  const send = await sendWhatsApp(msg);

  // Only latch the flag once the message actually went out, so a transient
  // failure is retried on the next cron run instead of being lost.
  if (send.sent) await kvSet(NOTIFY_KEY, "1");

  if (!kvConfigured()) send.warning = "no KV store configured — cannot de-dupe, will re-send every run";
  return { notified: send.sent, send };
}

module.exports = { notifyIfLive, sendWhatsApp, clearNotified, kvConfigured, NOTIFY_KEY };
