import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { loadConfig } from '../src/config.js';

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function launch(t, basePath) {
  const port = await unusedPort();
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), BASE_PATH: basePath, ICE_SERVERS: '[]', ICE_TRANSPORT_POLICY: 'all', MAX_PARTICIPANTS: '2', ALLOWED_ORIGINS: 'https://apps.example.com' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => { if (child.exitCode === null) { child.kill(); await once(child, 'exit'); } });
  const url = `http://127.0.0.1:${port}${basePath}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}health`)).ok) return { url, port }; } catch {}
    if (child.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Server not ready: ${output}`);
}
async function connect(t, url) {
  const ws = new WebSocket(url.replace('http:', 'ws:') + 'ws', { origin: 'https://apps.example.com' });
  const inbox = [];
  ws.on('message', data => inbox.push(JSON.parse(data)));
  await once(ws, 'open');
  t.after(() => ws.terminate());
  return {
    ws,
    send(type, payload = {}, requestId) { ws.send(JSON.stringify({ version: 1, type, payload, requestId })); },
    async next(type) {
      for (let i = 0; i < 100; i++) {
        const index = inbox.findIndex(m => m.type === type);
        if (index >= 0) return inbox.splice(index, 1)[0];
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error(`Missing ${type}: ${JSON.stringify(inbox)}`);
    }, inbox
  };
}

test('configuration rejects invalid ports, paths and ICE policy', () => {
  for (const port of ['0', '65536', '-1', 'abc', '3081x', '3.5']) assert.throws(() => loadConfig({ PORT: port }));
  assert.throws(() => loadConfig({ BASE_PATH: '/meet' }));
  assert.throws(() => loadConfig({ ICE_SERVERS: '{}' }));
  assert.throws(() => loadConfig({ ICE_TRANSPORT_POLICY: 'relay', ICE_SERVERS: '[]' }));
  assert.equal(loadConfig({ PORT: '4111', BASE_PATH: '/maia-meet/' }).port, 4111);
});

for (const basePath of ['/', '/maia-meet/']) test(`HTTP and room lifecycle at ${basePath}`, async t => {
  const { url, port } = await launch(t, basePath);
  assert.match(await (await fetch(url)).text(), /Maia Meet/);
  assert.match((await fetch(url + 'js/app.js')).headers.get('content-type'), /javascript/);
  assert.equal((await fetch(url + 'missing.js')).status, 404);
  assert.equal((await fetch(url + '%2e%2e%2fsignaling/package.json')).status, 404);
  assert.equal((await fetch(url + 'health', { method: 'POST' })).status, 405);
  if (basePath !== '/') {
    assert.equal((await fetch(url.slice(0, -1), { redirect: 'manual' })).status, 308);
    assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status, 404);
  }
  const wrongOrigin = new WebSocket(url.replace('http:', 'ws:') + 'ws', { origin: 'https://other.example.com' });
  const [originError] = await once(wrongOrigin, 'error');
  assert.match(originError.message, /403/);
  const a = await connect(t, url), b = await connect(t, url), c = await connect(t, url);
  a.ws.send('null');
  assert.equal((await a.next('error')).payload.code, 400);
  a.send('room.join', { roomId: 'room123', displayName: 'A' }, 'join-a');
  const joinedA = await a.next('room.joined');
  assert.equal(joinedA.requestId, 'join-a');
  assert.deepEqual(joinedA.payload.rtcConfig.iceServers, []);
  b.send('room.join', { roomId: 'room123', displayName: 'B' });
  const joinedB = await b.next('room.joined');
  assert.equal(joinedB.payload.participants.length, 2);
  await a.next('participant.joined');
  c.send('room.join', { roomId: 'room123', displayName: 'C' });
  assert.equal((await c.next('error')).payload.code, 409);
  c.send('room.join', { roomId: 'other123', displayName: 'C' });
  const joinedC = await c.next('room.joined');
  const targetId = joinedA.payload.participantId;
  b.send('webrtc.offer', { targetId, sdp: 'v=0\r\n', participantId: 'spoofed' });
  assert.equal((await a.next('webrtc.offer')).payload.participantId, joinedB.payload.participantId);
  a.send('webrtc.answer', { targetId: joinedB.payload.participantId, sdp: 'v=0\r\n' });
  await b.next('webrtc.answer');
  b.send('webrtc.iceCandidate', { targetId, candidate: 'candidate:test', sdpMid: '0', sdpMLineIndex: 0 });
  assert.equal((await a.next('webrtc.iceCandidate')).payload.candidate, 'candidate:test');
  a.send('webrtc.offer', { targetId: joinedC.payload.participantId, sdp: 'v=0\r\n' });
  assert.equal((await a.next('error')).payload.code, 404);
  a.send('chat.send', { text: 'hello' });
  assert.equal((await a.next('chat.message')).payload.text, 'hello');
  assert.equal((await b.next('chat.message')).payload.text, 'hello');
  b.ws.close();
  assert.equal((await a.next('participant.left')).payload.participantId, joinedB.payload.participantId);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(a.inbox.filter(m => m.type === 'chat.message').length, 0);
  assert.equal(c.inbox.length, 0);
});

test('interactive configuration saves chosen ports and preserves a private backup', async () => {
  const { mkdtemp, mkdir, copyFile, writeFile, readFile, stat, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { parseEnv } = await import('node:util');
  const dir = await mkdtemp(join(tmpdir(), 'maia-meet-config-'));
  try {
    await mkdir(join(dir, 'deploy'));
    await mkdir(join(dir, 'signaling/src'), { recursive: true });
    await writeFile(join(dir, 'package.json'), '{"type":"module"}');
    await copyFile(new URL('../../deploy/configure.mjs', import.meta.url), join(dir, 'deploy/configure.mjs'));
    await copyFile(new URL('../../.env.example', import.meta.url), join(dir, '.env.example'));
    await copyFile(new URL('../src/config.js', import.meta.url), join(dir, 'signaling/src/config.js'));
    const previous = 'PORT=4110\nICE_SERVERS=\'[{"urls":"stun:example.com:3479"}]\'\n';
    await writeFile(join(dir, '.env'), previous);
    const child = spawn(process.execPath, ['deploy/configure.mjs'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    const answers = ['127.0.0.1', '4111', '/maia-meet/', '4', 'https://apps.example.com'];
    let pending = '', error = '';
    child.stderr.on('data', chunk => { error += chunk; });
    child.stdout.on('data', chunk => {
      pending += chunk;
      if (pending.endsWith(': ') && answers.length) { child.stdin.write(answers.shift() + '\n'); pending = ''; }
    });
    const timer = setTimeout(() => child.kill(), 5000);
    const [code] = await once(child, 'exit');
    clearTimeout(timer);
    assert.equal(code, 0, error);
    const saved = parseEnv(await readFile(join(dir, '.env'), 'utf8'));
    assert.equal(saved.PORT, '4111');
    assert.equal(saved.BASE_PATH, '/maia-meet/');
    assert.equal(saved.MAX_PARTICIPANTS, '4');
    assert.equal(JSON.parse(saved.ICE_SERVERS)[0].urls, 'stun:example.com:3479');
    assert.equal(await readFile(join(dir, '.env.backup'), 'utf8'), previous);
    assert.equal((await stat(join(dir, '.env'))).mode & 0o777, 0o600);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
