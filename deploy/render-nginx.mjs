// Run from signaling: node --env-file=../.env ../deploy/render-nginx.mjs
// Emits a location snippet; no root access, deployment, or daemon reload.
import config from '../signaling/src/config.js';
import { isIP } from 'node:net';
if (!isIP(config.host)) throw new Error('Use an IP address in HOST to generate the local nginx upstream');
const host = config.host === '0.0.0.0' ? '127.0.0.1' : config.host === '::' ? '[::1]' : isIP(config.host) === 6 ? `[${config.host}]` : config.host;
if (config.basePath !== '/') console.log(`location = ${config.basePath.slice(0, -1)} { return 308 ${config.basePath}$is_args$args; }`);
console.log(`location ^~ ${config.basePath} {
    # Preserve the path: BASE_PATH is handled by the Node server.
    proxy_pass http://${host}:${config.port};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    proxy_buffering off;
}`);
