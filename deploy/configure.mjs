import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../signaling/src/config.js';

const file = new URL('../.env', import.meta.url);
let previous = '';
try { previous = await readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const values = { ...parseEnv(await readFile(new URL('../.env.example', import.meta.url), 'utf8')), ...parseEnv(previous) };
const rl = createInterface({ input: stdin, output: stdout });
try {
    for (const [key, label] of [
        ['HOST', 'Listen address (loopback for local nginx; VPN IP for direct Edge proxy)'],
        ['PORT', 'HTTP + WebSocket port'],
        ['BASE_PATH', 'URL path (/ or /maia-meet/)'],
        ['MAX_PARTICIPANTS', 'Maximum participants per room'],
        ['ALLOWED_ORIGINS', 'Allowed browser origins (comma separated; blank keeps current)']
    ]) {
        const answer = await rl.question(`${label} [${values[key]}]: `);
        if (answer.trim()) values[key] = answer.trim();
    }
    loadConfig(values);
    if (Object.values(values).some(value => /[\r\n']/.test(value))) throw new Error('Values cannot contain newlines or single quotes');
    if (previous) await writeFile(new URL('../.env.backup', import.meta.url), previous, { mode: 0o600 });
    await writeFile(file, Object.entries(values).map(([key, value]) => `${key}='${value}'`).join('\n') + '\n', { mode: 0o600 });
    await chmod(file, 0o600);
    console.log(`Saved ${fileURLToPath(file)}. Configure ICE_SERVERS there for Internet calls. Run: make signaling-start`);
} finally { rl.close(); }
