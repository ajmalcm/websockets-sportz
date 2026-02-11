import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

const matchSubscribers = new Map();

function subscribe(matchId, socket) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribe(matchId, socket);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) return;

  socket.send(JSON.stringify(payload));
}

function broadCastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(JSON.stringify(payload));
  }
}
function broadcastToMatchSubscribers(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function handleMessage(socket, message)
{
    try{
        message=JSON.parse(message.toString());
    }catch(err)
    {
        sendJson(socket,{type:"error",error:"Invalid JSON"});
        return;
    }

    if(message?.type=='subscribe' && Number.isInteger(message.matchId))
    {
        subscribe(message.matchId,socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket,{type:"subscribed",matchId:message.matchId});
        return;
    }

    if(message?.type=='unsubscribe' && Number.isInteger(message.matchId))
    {
        unsubscribe(message.matchId,socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket,{type:"unsubscribed",matchId:message.matchId});
        return;
    }
}

export function attachWebSocketServer(server) {
  // Use noServer:true so we control the HTTP upgrade handling ourselves
  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  // Move Arcjet protection to the HTTP 'upgrade' handler so upgrades can be denied early
  server.on("upgrade", async (req, socket, head) => {
    // Only handle the configured websocket path here
    if (req.url !== "/ws") return;

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          // Map Arcjet reasons to HTTP status and close behavior
          const isRateLimit =
            decision.reason &&
            typeof decision.reason.isRateLimit === "function" &&
            decision.reason.isRateLimit();
          const statusLine = isRateLimit
            ? "HTTP/1.1 429 Too Many Requests"
            : "HTTP/1.1 403 Forbidden";
          const reason = isRateLimit ? "Rate limit exceeded" : "Access denied";

          try {
            socket.write(
              `${statusLine}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(reason)}\r\n\r\n${reason}`,
            );
          } catch (err) {
            // ignore socket write errors
          }
          socket.destroy();
          return;
        }
      } catch (error) {
        console.error("WS upgrade protection error", error);
        const reason = "Server security error.";
        try {
          socket.write(
            `HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(reason)}\r\n\r\n${reason}`,
          );
        } catch (err) {
          // ignore
        }
        socket.destroy();
        return;
      }
    }

    // If protection passed (or not configured), proceed with WebSocket handshake
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (socket, req) => {
    // At this point Arcjet protection has already run during upgrade
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.subscriptions = new Set();
    socket.on("message", (message) => handleMessage(socket, message));
    socket.on("close", () => cleanupSubscriptions(socket));

    // Unified error handler: log and terminate socket
    socket.on('error', (err) => {
      console.error('WebSocket error', err);
      try { socket.terminate(); } catch (e) { /* ignore */ }
    });

    sendJson(socket, { type: "welcome" });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 3000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadCastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId,comment)
  {
    broadcastToMatchSubscribers(matchId,{type:"commentary",data:comment})
  }

  return { broadcastMatchCreated ,broadcastCommentary};
}
