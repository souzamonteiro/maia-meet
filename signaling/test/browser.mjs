// npm install --no-save playwright && npx playwright install chromium
// npm run test:browser (optional CHROME_PATH and PLAYWRIGHT_MODULE overrides)
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join as joinPath } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
const { chromium, firefox } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const socket = createServer().listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
const server = spawn(process.execPath, ['src/server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), BASE_PATH: '/maia-meet/', ICE_SERVERS: '[]', ICE_TRANSPORT_POLICY: 'all', MAX_PARTICIPANTS: '6', ALLOWED_ORIGINS: '' },
    stdio: ['ignore', 'pipe', 'inherit']
});
let browser;
let firefoxBrowser;
let nginx;
let nginxDirectory;
const errors = [];
try {
    let url = `http://127.0.0.1:${port}/maia-meet/`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
        try { if ((await fetch(url + 'health')).ok) { ready = true; break; } } catch {}
        await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.ok(ready, 'Server starts');
    if (process.env.NGINX_PATH) {
        async function freePort() {
            const listener = createServer().listen(0, '127.0.0.1');
            await once(listener, 'listening');
            const result = listener.address().port;
            await new Promise(resolve => listener.close(resolve));
            return result;
        }
        const gatewayPort = await freePort();
        const appsPort = await freePort();
        nginxDirectory = await mkdtemp(joinPath(tmpdir(), 'maia-meet-nginx-'));
        const location = execFileSync(process.execPath, ['../deploy/render-nginx.mjs'], {
            cwd: new URL('../', import.meta.url),
            env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), BASE_PATH: '/maia-meet/' }, encoding: 'utf8'
        });
        const configFile = joinPath(nginxDirectory, 'nginx.conf');
        await writeFile(configFile, `pid ${nginxDirectory}/nginx.pid;
error_log stderr;
events {}
http {
    access_log off;
    client_body_temp_path ${nginxDirectory}/client;
    proxy_temp_path ${nginxDirectory}/proxy;
    server {
        listen 127.0.0.1:${gatewayPort};
        location / {
            proxy_pass http://127.0.0.1:${appsPort};
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
    server { listen 127.0.0.1:${appsPort}; ${location} }
}`);
        nginx = spawn(process.env.NGINX_PATH, ['-p', nginxDirectory, '-c', configFile, '-g', 'daemon off; master_process off;'], { stdio: ['ignore', 'ignore', 'pipe'] });
        let nginxErrors = '';
        nginx.stderr.on('data', data => { nginxErrors += data; });
        url = `http://127.0.0.1:${gatewayPort}/maia-meet/`;
        let proxyReady = false;
        for (let i = 0; i < 100; i++) {
            try { if ((await fetch(url + 'health')).ok) { proxyReady = true; break; } } catch {}
            if (nginx.exitCode !== null) throw new Error(nginxErrors);
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        assert.ok(proxyReady, 'Two proxy hops start');
    }
    browser = await chromium.launch({
        executablePath: process.env.CHROME_PATH || undefined,
        headless: true,
        args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--no-sandbox']
    });
    if (process.env.TEST_FIREFOX) firefoxBrowser = await firefox.launch({ headless: true });
    const pages = [];
    async function join(name, mode = 'devices', roomId = 'test123') {
        const context = mode === 'denied' && firefoxBrowser
            ? await firefoxBrowser.newContext()
            : await browser.newContext({ permissions: ['camera', 'microphone'] });
        await context.addInitScript(() => {
            window.testPeers = [];
            const Original = window.RTCPeerConnection;
            window.RTCPeerConnection = class extends Original {
                constructor(...args) { super(...args); window.testPeers.push(this); }
            };
            navigator.mediaDevices.getDisplayMedia = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = 640; canvas.height = 480;
                const ctx = canvas.getContext('2d');
                const timer = setInterval(() => { ctx.fillStyle = 'green'; ctx.fillRect(0, 0, 640, 480); }, 30);
                const stream = canvas.captureStream(20);
                window.testScreenTrack = stream.getVideoTracks()[0];
                stream.getVideoTracks()[0].addEventListener('ended', () => clearInterval(timer));
                return stream;
            };
        });
        if (mode === 'denied') await context.addInitScript(() => {
            navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
        });
        if (mode === 'pending') await context.addInitScript(() => {
            navigator.mediaDevices.getUserMedia = () => new Promise(() => {});
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url + '?room=' + roomId);
        await page.fill('#display-name', name);
        assert.equal(await page.inputValue('#room-id'), roomId);
        await page.click('#btn-join-lobby');
        await page.waitForFunction(() => !document.getElementById('btn-join-room').disabled);
        if (mode === 'devices') await page.waitForFunction(() => document.getElementById('local-preview-video').srcObject?.getTracks().length === 2);
        await page.click(mode === 'pending' ? '#btn-join-without-devices' : '#btn-join-room');
        await page.waitForFunction(() => document.querySelectorAll('#participants-list li').length > 0);
        pages.push(page);
        return page;
    }
    async function media(count) {
        for (const page of pages) {
            await page.waitForFunction(async expected => {
                const pcs = window.testPeers.filter(pc => pc.connectionState !== 'closed');
                if (pcs.length !== expected || pcs.some(pc => pc.connectionState !== 'connected')) return false;
                for (const pc of pcs) {
                    const stats = [...(await pc.getStats()).values()];
                    if (!stats.some(s => s.type === 'inbound-rtp' && s.kind === 'video' && s.framesDecoded > 0)) return false;
                    if (!stats.some(s => s.type === 'inbound-rtp' && s.kind === 'audio' && s.bytesReceived > 0)) return false;
                }
                return document.querySelectorAll('.video-tile:not(.local) video').length === expected;
            }, count, { timeout: 25000 });
        }
    }
    const a = await join('Alice');
    const b = await join('Bob');
    await media(1);
    await a.click('#btn-toggle-screen');
    await a.waitForFunction(() => window.testPeers[0].getSenders().some(s => s.track === window.testScreenTrack));
    const c = await join('Carol');
    await media(2);
    assert.ok(await a.evaluate(() => window.testPeers.every(pc => pc.getSenders().some(s => s.track === window.testScreenTrack))), 'Late joiners receive shared screen');
    await a.click('#btn-toggle-screen');
    await a.waitForFunction(() => window.testPeers.every(pc => !pc.getSenders().some(s => s.track === window.testScreenTrack)));
    await a.click('#btn-toggle-chat');
    await a.fill('#chat-input', 'Only once');
    await a.click('#btn-send-chat');
    for (const page of pages) {
        await page.waitForFunction(() => document.querySelectorAll('.chat-message').length === 1);
        assert.equal(await page.locator('.chat-message .text').textContent(), 'Only once');
    }
    await b.click('#btn-leave');
    await a.waitForFunction(() => document.querySelectorAll('.video-tile').length === 2);
    await c.waitForFunction(() => document.querySelectorAll('.video-tile').length === 2);
    await b.click('#btn-join-lobby');
    await b.waitForFunction(() => !document.getElementById('btn-join-room').disabled);
    await b.waitForFunction(() => document.getElementById('local-preview-video').srcObject?.getTracks().length === 2);
    await b.click('#btn-join-room');
    await media(2);
    const guest = await join('Guest without devices', 'denied');
    await guest.waitForFunction(async () => {
        const pcs = window.testPeers;
        if (pcs.length !== 3) return false;
        for (const pc of pcs) {
            const stats = [...(await pc.getStats()).values()];
            if (!stats.some(s => s.type === 'inbound-rtp' && s.kind === 'video' && s.framesDecoded > 0)) return false;
            if (!stats.some(s => s.type === 'inbound-rtp' && s.kind === 'audio' && s.bytesReceived > 0)) return false;
            if (pc.getSenders().some(s => s.track)) return false;
        }
        return true;
    });
    assert.equal(await a.locator('#participants-list li').count(), 4);
    const pending = await join('Pending permissions', 'pending');
    await pending.waitForFunction(() => document.querySelectorAll('#participants-list li').length === 5);
    // Same browser context, using the actual invitation URL shown to the user.
    const tab = await a.context().newPage();
    await tab.goto(await a.inputValue('#meeting-link'));
    assert.equal(await tab.locator('#btn-new-meeting').isVisible(), false);
    await tab.fill('#display-name', 'Second tab');
    await tab.check('#join-as-viewer');
    await tab.click('#btn-join-lobby');
    await tab.click('#btn-join-without-devices');
    await tab.waitForFunction(() => document.querySelectorAll('#participants-list li').length === 6);
    await a.waitForFunction(() => document.querySelectorAll('#participants-list li').length === 6);
    await tab.click('#btn-toggle-screen');
    await tab.waitForFunction(() => window.testPeers.length === 5 && window.testPeers.every(pc => pc.getSenders().some(s => s.track === window.testScreenTrack)));
    await tab.click('#btn-toggle-screen');
    await tab.waitForFunction(() => window.testPeers.every(pc => pc.getSenders().every(s => !s.track)));
    await tab.click('#btn-toggle-mic');
    await tab.click('#btn-toggle-cam');
    await tab.waitForFunction(() => window.testPeers.length === 5 && window.testPeers.every(pc => pc.getSenders().filter(s => s.track).length === 2));
    await tab.close();
    await pending.close();
    await guest.close();
    const firstViewer = await join('First viewer', 'denied', 'viewerfirst');
    const teacher = await join('Teacher arrives later', 'devices', 'viewerfirst');
    await firstViewer.waitForFunction(async () => {
        const pc = window.testPeers[0];
        if (!pc) return false;
        const stats = [...(await pc.getStats()).values()];
        return stats.some(s => s.type === 'inbound-rtp' && s.kind === 'video' && s.framesDecoded > 0)
            && stats.some(s => s.type === 'inbound-rtp' && s.kind === 'audio' && s.bytesReceived > 0);
    });
    for (const button of await firstViewer.locator('.media-play:visible').all()) await button.click();
    await firstViewer.waitForFunction(() => [...document.querySelectorAll('.video-tile:not(.local) video')].some(v => !v.paused && v.currentTime > 0));
    await firstViewer.close();
    await teacher.close();
    assert.deepEqual(errors, []);
    console.log('PASS: denied/pending permissions, receive-only participants, same-context invitation tab, enable devices after joining; three browsers exchange audio/video; screen share, late join, chat, leave/rejoin, Apps prefix and invitation URL' + (nginx ? ' through two nginx proxies' : ''));
} finally {
    await firefoxBrowser?.close();
    await browser?.close();
    if (nginx && nginx.exitCode === null) { nginx.kill(); await once(nginx, 'exit'); }
    if (nginxDirectory) await rm(nginxDirectory, { recursive: true, force: true });
    if (server.exitCode === null) { server.kill(); await once(server, 'exit'); }
}
