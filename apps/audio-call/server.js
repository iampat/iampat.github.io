const http = require("http");
const PORT = process.env.PORT || 3000;

const clients = new Map(); // id -> { queue: [], lastPoll: Date.now() }
let clientId = 0;

// Expire clients that haven't polled in 10s
setInterval(() => {
  const now = Date.now();
  for (const [id, client] of clients) {
    if (now - client.lastPoll > 10000) {
      clients.delete(id);
      console.log(`- client ${id} expired (${clients.size} total)`);
      broadcast(id, { type: "peer-left" });
    }
  }
}, 3000);

function broadcast(senderId, data) {
  for (const [id, client] of clients) {
    if (id !== senderId) client.queue.push(data);
  }
}

function parseURL(url) {
  return new URL(url, "http://localhost");
}

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = parseURL(req.url);

  if (parsed.pathname === "/connect" && req.method === "GET") {
    const id = ++clientId;
    clients.set(id, { queue: [], lastPoll: Date.now() });
    console.log(`+ client ${id} (${clients.size} total)`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id }));
    return;
  }

  if (parsed.pathname === "/poll" && req.method === "GET") {
    const id = Number(parsed.searchParams.get("id"));
    const client = clients.get(id);
    if (!client) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "unknown client" }));
      return;
    }
    client.lastPoll = Date.now();
    const msgs = client.queue.splice(0);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(msgs));
    return;
  }

  if (parsed.pathname === "/signal" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const msg = JSON.parse(body);
      broadcast(msg.senderId, msg);
      res.writeHead(200);
      res.end("ok");
    });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
});

server.listen(PORT, () => {
  console.log(`Signaling server on http://localhost:${PORT}`);
});
