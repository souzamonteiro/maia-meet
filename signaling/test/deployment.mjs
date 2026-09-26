// Exercise the VPS configuration locally; never touch installed nginx/systemd.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { get } from 'node:https';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { WebSocket } from 'ws';
const tmp = await mkdtemp('/tmp/maia-meet-vps-test.');
let backend, nginx, ws;
async function port() {
    const s = createServer().listen(0, '127.0.0.1');
    await once(s, 'listening');
    const p = s.address().port;
    await new Promise(r => s.close(r));
    return p;
}
function tlsGet(url) {
    return new Promise((resolve, reject) => {
        get(url, { rejectUnauthorized: false, headers: { Host: 'meet.maiaplatform.org' } }, res => {
            let body = ''; res.on('data', d => body += d); res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}
try {
    const backendPort = await port(), httpPort = await port(), httpsPort = await port();
    backend = spawn(process.execPath, ['src/server.js'], { cwd: new URL('../', import.meta.url),
        env: { ...process.env, HOST: '127.0.0.1', PORT: String(backendPort), BASE_PATH: '/', ALLOWED_ORIGINS: 'https://meet.maiaplatform.org' }, stdio: 'ignore' });
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=meet.maiaplatform.org', '-keyout', tmp+'/key.pem', '-out', tmp+'/cert.pem'], { stdio: 'ignore' });
    let vhost = execFileSync('python3', ['../../deploy/install-vps.py', '--dry-run', '--upstream', `127.0.0.1:${backendPort}`, '--cert', tmp+'/cert.pem', '--key', tmp+'/key.pem'], { cwd: new URL('./', import.meta.url), encoding: 'utf8' });
    vhost = vhost.replace('listen 80;', `listen 127.0.0.1:${httpPort};`).replace('listen 443 ssl;', `listen 127.0.0.1:${httpsPort} ssl;`);
    await writeFile(tmp+'/nginx.conf', `pid ${tmp}/nginx.pid; error_log stderr; events {} http { access_log off; client_body_temp_path ${tmp}/body; proxy_temp_path ${tmp}/proxy; ${vhost} }`);
    nginx = spawn('/usr/sbin/nginx', ['-p', tmp, '-c', tmp+'/nginx.conf', '-g', 'daemon off; master_process off;'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let ready = false;
    for (let i=0;i<100;i++) {
        try { if ((await tlsGet(`https://127.0.0.1:${httpsPort}/health`)).status === 200) { ready = true; break; } } catch {}
        await new Promise(r => setTimeout(r, 30));
    }
    assert.ok(ready, 'TLS proxy and backend start');
    const redirect = await fetch(`http://127.0.0.1:${httpPort}/?room=lesson123`, { redirect: 'manual', headers: { Host: 'meet.maiaplatform.org' } });
    assert.equal(redirect.headers.get('location'), 'https://meet.maiaplatform.org/?room=lesson123');
    assert.match((await tlsGet(`https://127.0.0.1:${httpsPort}/`)).body, /btn-copy-invite/);
    assert.match((await tlsGet(`https://127.0.0.1:${httpsPort}/js/config.js`)).body, /signalingUrl/);
    ws = new WebSocket(`wss://127.0.0.1:${httpsPort}/ws`, { rejectUnauthorized: false, origin: 'https://meet.maiaplatform.org', headers: { Host: 'meet.maiaplatform.org' } });
    await once(ws, 'open');
    const response = once(ws, 'message');
    ws.send(JSON.stringify({ version: 1, type: 'room.join', payload: { roomId: 'lesson123', displayName: 'VPS test' } }));
    assert.equal(JSON.parse((await response)[0]).type, 'room.joined');
    console.log('PASS: generated VPS HTTPS proxy, HTTP redirect preserving room query, root client/assets and WSS room join');
} finally {
    ws?.terminate();
    for (const child of [nginx, backend]) if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
    await rm(tmp, { recursive: true, force: true });
}
