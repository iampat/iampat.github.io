const { WebSocketServer } = require("ws");
const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ port: PORT });

const clients = new Set();

function broadcast(sender, data) {
  for (const c of clients) {
    if (c !== sender && c.readyState === 1) c.send(JSON.stringify(data));
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`+ client (${clients.size} total)`);

  ws.on("message", (raw) => {
    const msg = JSON.parse(raw);
    // relay everything to all other clients
    broadcast(ws, msg);
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`- client (${clients.size} total)`);
    broadcast(ws, { type: "peer-left" });
  });
});

console.log(`Signaling server on ws://localhost:${PORT}`);
