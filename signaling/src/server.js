import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import config from './config.js';
import logger from './logger.js';

const clientRoot = resolve(fileURLToPath(new URL('../../client/', import.meta.url)));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const rooms = new Map();
const send = (ws, type, payload = {}, requestId) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ version: 1, type, payload, requestId }));
};
const broadcast = (room, type, payload, except) => {
  for (const p of room.values()) if (p.id !== except) send(p.ws, type, payload);
};
const publicParticipant = ({ id, displayName }) => ({ id, displayName });

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    if (config.basePath !== '/' && pathname === config.basePath.slice(0, -1)) {
      res.writeHead(308, { Location: config.basePath + new URL(req.url, 'http://localhost').search }).end(); return;
    }
    if (!pathname.startsWith(config.basePath)) { res.writeHead(404).end(); return; }
    const relative = pathname.slice(config.basePath.length);
    if (relative === 'health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: 'ok', mediaMode: 'mesh' })); return;
    }
    const path = resolve(clientRoot, relative || 'index.html');
    if (!path.startsWith(clientRoot + sep) || !mime[extname(path)]) { res.writeHead(404).end(); return; }
    const contents = await readFile(path);
    res.setHeader('Content-Type', mime[extname(path)]);
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404).end();
  }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: config.maxMessageBytes });
server.on('upgrade', (req, socket, head) => {
  if (req.url !== `${config.basePath}ws` ||
      (config.allowedOrigins.length && !config.allowedOrigins.includes(req.headers.origin))) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws));
});
wss.on('connection', ws => {
  let participant;
  let tokens = config.rateLimitTokens;
  let lastRefill = Date.now();
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', error => logger.error('WebSocket error', error.message));
  ws.on('message', (data, isBinary) => {
    let requestId;
    const fail = (code, message) => send(ws, 'error', { code, message }, requestId);
    try {
      if (Date.now() - lastRefill >= config.rateLimitInterval) { tokens = config.rateLimitTokens; lastRefill = Date.now(); }
      if (--tokens < 0) { fail(429, 'Rate limit exceeded'); return; }
      const msg = isBinary ? null : JSON.parse(data.toString());
      if (!msg || typeof msg !== 'object' || msg.version !== 1 || typeof msg.type !== 'string' ||
          !msg.payload || typeof msg.payload !== 'object' || Array.isArray(msg.payload)) {
        fail(400, 'Invalid message format'); return;
      }
      requestId = typeof msg.requestId === 'string' ? msg.requestId : undefined;
      const { type, payload } = msg;
      if (type === 'ping') { send(ws, 'pong', {}, requestId); return; }
      if (type === 'room.create') { send(ws, 'room.created', { roomId: randomUUID().replaceAll('-', '') }, requestId); return; }
      if (type === 'room.join') {
        if (participant) { fail(409, 'Already joined a room'); return; }
        if (typeof payload.roomId !== 'string' || !/^[a-zA-Z0-9]{3,32}$/.test(payload.roomId) ||
            typeof payload.displayName !== 'string' || !payload.displayName.trim() || payload.displayName.length > 50) {
          fail(400, 'Invalid room ID or display name'); return;
        }
        const room = rooms.get(payload.roomId) || new Map();
        if (room.size >= config.maxParticipants) { fail(409, 'Room is full'); return; }
        participant = { id: randomUUID(), displayName: payload.displayName.trim(), roomId: payload.roomId, ws };
        room.set(participant.id, participant);
        rooms.set(participant.roomId, room);
        send(ws, 'room.joined', {
          participantId: participant.id, roomId: participant.roomId,
          participants: [...room.values()].map(publicParticipant),
          mediaMode: 'mesh', rtcConfig: config.rtcConfig
        }, requestId);
        broadcast(room, 'participant.joined', { participant: publicParticipant(participant) }, participant.id);
        return;
      }
      if (!participant) { fail(403, 'Join a room first'); return; }
      const room = rooms.get(participant.roomId);
      if (['webrtc.offer', 'webrtc.answer', 'webrtc.iceCandidate'].includes(type)) {
        const target = room.get(payload.targetId);
        if (!target || target.id === participant.id) { fail(404, 'Participant not in this room'); return; }
        let forwarded;
        if (type === 'webrtc.iceCandidate') {
          if (typeof payload.candidate !== 'string' || payload.candidate.length > 4096 ||
              !(payload.sdpMid == null || typeof payload.sdpMid === 'string') ||
              !(payload.sdpMLineIndex == null || (Number.isInteger(payload.sdpMLineIndex) && payload.sdpMLineIndex >= 0))) {
            fail(400, 'Invalid ICE candidate'); return;
          }
          forwarded = { candidate: payload.candidate, sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex };
        } else {
          if (typeof payload.sdp !== 'string' || !payload.sdp.startsWith('v=0')) { fail(400, 'Invalid SDP'); return; }
          forwarded = { sdp: payload.sdp };
        }
        send(target.ws, type, { ...forwarded, participantId: participant.id });
        return;
      }
      if (type === 'chat.send') {
        if (typeof payload.text !== 'string' || !payload.text.trim() || payload.text.length > 4000) { fail(400, 'Invalid chat message'); return; }
        broadcast(room, 'chat.message', {
          participantId: participant.id, displayName: participant.displayName,
          text: payload.text.trim(), timestamp: new Date().toISOString()
        }); return;
      }
      fail(400, 'Unknown message type');
    } catch (error) {
      fail(400, 'Invalid message');
    }
  });
  ws.on('close', () => {
    if (!participant) return;
    const room = rooms.get(participant.roomId);
    room.delete(participant.id);
    broadcast(room, 'participant.left', { participantId: participant.id });
    if (!room.size) rooms.delete(participant.roomId);
  });
});
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
server.on('error', error => { logger.error('HTTP server failed', error.message); clearInterval(heartbeat); process.exitCode = 1; });
server.listen(config.port, config.host, () => logger.info(`Maia Meet listening on http://${config.host}:${config.port}${config.basePath} (mesh)`));
function shutdown() {
  clearInterval(heartbeat);
  for (const ws of wss.clients) ws.terminate();
  wss.close();
  server.close();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
