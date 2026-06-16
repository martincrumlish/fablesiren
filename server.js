// Zero-dependency Fable 5 endpoint pinger.
// Serves the browser widget and proxies the API check so the key stays server-side.

const http = require("http");
const fs = require("fs");
const path = require("path");

// --- minimal .env loader ---
function loadEnv(file) {
  const env = {};
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[m[1]] = val;
    }
  } catch (e) {
    console.error("Could not read .env:", e.message);
  }
  return env;
}

const env = loadEnv(path.join(__dirname, ".env"));
const API_KEY = env.ANTHROPIC_KEY || process.env.ANTHROPIC_KEY;
const MODEL = "claude-fable-5";
const PORT = 5757;

if (!API_KEY) {
  console.error("No ANTHROPIC_KEY found in .env — the check will fail.");
}

// Calls the Anthropic Messages API once and classifies the result.
async function checkEndpoint() {
  if (!API_KEY) {
    return { ok: false, working: false, status: 0, reason: "no_api_key", detail: "ANTHROPIC_KEY missing from .env" };
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

    // 404 / not_found_error => model exists in API surface but isn't available yet.
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

const server = http.createServer(async (req, res) => {
  if (req.url === "/check") {
    const result = await checkEndpoint();
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ ...result, model: MODEL, time: new Date().toISOString() }));
    return;
  }

  if (req.url === "/siren.mp3") {
    const file = path.join(__dirname, "siren.mp3");
    fs.stat(file, (err, stat) => {
      if (err) {
        res.writeHead(404);
        res.end("siren.mp3 not found");
        return;
      }
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
        const start = parseInt(m[1], 10) || 0;
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
        res.writeHead(206, {
          "content-type": "audio/mpeg",
          "content-range": `bytes ${start}-${end}/${stat.size}`,
          "accept-ranges": "bytes",
          "content-length": end - start + 1,
        });
        fs.createReadStream(file, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          "content-type": "audio/mpeg",
          "content-length": stat.size,
          "accept-ranges": "bytes",
        });
        fs.createReadStream(file).pipe(res);
      }
    });
    return;
  }

  if (req.url === "/" || req.url === "/index.html") {
    fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("index.html not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(data);
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n  Fable 5 Pinger running:  http://localhost:${PORT}\n`);
  console.log(`  Watching model: ${MODEL}`);
  console.log(`  API key loaded: ${API_KEY ? "yes" : "NO — add ANTHROPIC_KEY to .env"}\n`);
});
