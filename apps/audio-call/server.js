const http = require("http");
const PORT = process.env.PORT || 3000;

const clients = new Set();
let clientId = 0;

function broadcast(sender, data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (c !== sender) c.res.write(msg);
  }
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

  if (req.url === "/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(":\n\n");
    const client = { id: ++clientId, res };
    clients.add(client);
    console.log(`+ client ${client.id} (${clients.size} total)`);
    req.on("close", () => {
      clients.delete(client);
      console.log(`- client ${client.id} (${clients.size} total)`);
      broadcast(client, { type: "peer-left" });
    });
    return;
  }

  if (req.url === "/signal" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const msg = JSON.parse(body);
      broadcast(null, msg);
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
