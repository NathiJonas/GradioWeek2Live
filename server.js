const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || "";

if (!API_KEY) {
  console.warn("\x1b[33m⚠  WARNING: ANTHROPIC_API_KEY not set. Export it before running:\x1b[0m");
  console.warn("   export ANTHROPIC_API_KEY=sk-ant-...\n");
}

const SYSTEM_PROMPT = `
You are a senior software engineer and technical educator.
Explain programming concepts clearly.
Break down code step by step.
Mention edge cases and improvements.
`;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Serve frontend
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    const filePath = path.join(__dirname, "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(500); return res.end("Error loading index.html"); }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // Proxy to Anthropic API with streaming
  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch {
        res.writeHead(400); return res.end("Bad JSON");
      }

      const payload = JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: parsed.messages,
        stream: true,
      });

      const options = {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Length": Buffer.byteLength(payload),
        },
      };

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const apiReq = https.request(options, (apiRes) => {
        apiRes.on("data", (chunk) => res.write(chunk));
        apiRes.on("end", () => res.end());
      });

      apiReq.on("error", (err) => {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
      });

      apiReq.write(payload);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("\x1b[32m✓ AI Technical Tutor running at:\x1b[0m \x1b[36mhttp://localhost:" + PORT + "\x1b[0m");
  console.log("  Press Ctrl+C to stop.\n");
});
