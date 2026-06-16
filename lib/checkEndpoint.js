// Core check logic, shared by the Vercel function (api/check.js) and local server.js.
// Reads the key from process.env so it works on Vercel (env settings) and locally
// (server.js loads .env into process.env first).

const MODEL = "claude-fable-5";

async function checkEndpoint() {
  const API_KEY = process.env.ANTHROPIC_KEY;
  if (!API_KEY) {
    return { ok: false, working: false, status: 0, reason: "no_api_key", detail: "ANTHROPIC_KEY is not set" };
  }
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    const status = res.status;
    let body;
    try {
      body = await res.json();
    } catch {
      body = {};
    }

    if (res.ok) {
      return { ok: true, working: true, status, reason: "live", detail: `${MODEL} responded 200 OK` };
    }

    const errType = body && body.error && body.error.type;
    const errMsg = (body && body.error && body.error.message) || res.statusText;

    const notAvailable =
      status === 404 ||
      errType === "not_found_error" ||
      /model/i.test(errMsg || "");

    return {
      ok: false,
      working: false,
      status,
      reason: notAvailable ? "not_available" : errType || "error",
      detail: errMsg,
    };
  } catch (e) {
    return { ok: false, working: false, status: 0, reason: "network_error", detail: e.message };
  }
}

module.exports = { checkEndpoint, MODEL };
