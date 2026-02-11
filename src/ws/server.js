import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket,payload)
{
    if(socket.readyState!==WebSocket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadCast(wss,payload)
{
    for(const client of wss.clients)
    {
        if(client.readyState!==WebSocket.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}

export function attachWebSocketServer(server)
{
    const wss=new WebSocketServer({server,path:"/ws",maxPayload:1024*1024});

    // Move Arcjet protection to the HTTP 'upgrade' handler so upgrades can be denied early
    server.on('upgrade', async (req, socket, head) => {
        // Only handle the configured websocket path here
        if (req.url !== '/ws') return;

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    // Map Arcjet reasons to HTTP status and close behavior
                    const isRateLimit = decision.reason && typeof decision.reason.isRateLimit === 'function' && decision.reason.isRateLimit();
                    const statusLine = isRateLimit ? 'HTTP/1.1 429 Too Many Requests' : 'HTTP/1.1 403 Forbidden';
                    const reason = isRateLimit ? 'Rate limit exceeded' : 'Access denied';

                    try {
                        socket.write(`${statusLine}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(reason)}\r\n\r\n${reason}`);
                    } catch (err) {
                        // ignore socket write errors
                    }
                    socket.destroy();
                    return;
                }
            } catch (error) {
                console.error('WS upgrade protection error', error);
                const reason = 'Server security error.';
                try {
                    socket.write(`HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(reason)}\r\n\r\n${reason}`);
                } catch (err) {
                    // ignore
                }
                socket.destroy();
                return;
            }
        }

        // If protection passed (or not configured), proceed with WebSocket handshake
        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', (socket, req) => {
        // At this point Arcjet protection has already run during upgrade
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });
        sendJson(socket, { type: 'welcome' });
        socket.on('error', console.error);
    });

    const interval=setInterval(()=>{
        wss.clients.forEach((ws)=>{
            if(ws.isAlive===false) return ws.terminate();

            ws.isAlive=false;
            ws.ping()
        })
    },3000)

    wss.on('close',()=>clearInterval(interval))

    function broadcastMatchCreated(match)
    {
        broadCast(wss,{type:"match_created",data:match})
    }

    return {broadcastMatchCreated}

}