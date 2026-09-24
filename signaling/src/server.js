import { WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 3081);
const wss = new WebSocketServer({ port });

wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ version: 1, type: 'server.hello', payload: { name: 'Maia Meet Signaling' } }));
});

console.log(`Maia Meet Signaling listening on :${port}`);
