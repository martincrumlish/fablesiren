// Local dev server (not used on Vercel). Serves public/ and /api/check,
// reusing the same check logic as the Vercel function.
// Run: node server.js   ->   http://localhost:5757

const http = require("http");
const fs = require("fs");
const path = require("path");

// --- load .env into process.env so lib/checkEndpoint can read ANTHROPIC_KEY ---
(function loadEnv(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  } catch (e) {
    console.error("Could not read .env:", e.message);
  }
})(path.join(__dirname, ".env"));

const { checkEndpoint, MODEL } = require("./lib/checkEndpoint");
const PORT = 5757;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".js": "text/javascript",
  ".css": "text/css",
};

function serveStatic(req, res, urlPath) {
  const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const file = path.join(PUBLIC, path.normalize(rel));
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const type = MIME[path.extname(file)] || "application/octet-stream";
    const range = req.headers.range;
    if (range && type === "audio/mpeg") {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const start = parseInt(m[1], 10) || 0;
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      res.writeHead(206, {
        "content-type": type,
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
      });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { "content-type": type, "content-length": stat.size, "accept-ranges": "bytes" });
      fs.createReadStream(file).pipe(res);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0];
  if (urlPath === "/api/check") {
    const result = await checkEndpoint();
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ ...result, model: MODEL, time: new Date().toISOString() }));
    return;
  }
  serveStatic(req, res, urlPath);
});

server.listen(PORT, () => {
  console.log(`\n  Fable 5 Pinger (local):  http://localhost:${PORT}\n`);
  console.log(`  Watching model: ${MODEL}`);
  console.log(`  API key loaded: ${process.env.ANTHROPIC_KEY ? "yes" : "NO — add ANTHROPIC_KEY to .env"}\n`);
});
