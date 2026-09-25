# Running Maia Meet

## Working application and experimental SFU

The default application uses WebRTC mesh for small rooms (6 participants by
default). Each browser sends media to the other browsers, directly or through
TURN. Node serves the client and relays room signaling/chat on one TCP port.
No SFU build, UDP port forwarding to Node, or separate static server is required.

The native SFU is **experimental, not a working conference backend**: its SDP,
ICE candidate delivery, publication/subscription routing and participant mapping
still need implementation and interoperability tests. Its health endpoint only
reports control-server availability. Do not deploy it as the media backend yet.

## Local development

Requires Node.js 22+ and npm.

```bash
cd maia-meet
make configure                  # asks for host, port, URL path and room limit
make install-deps
make signaling-start
```

Alternatively copy `.env.example` to `.env` and edit it. `npm start` and `npm run
dev` in `signaling/` read this file; existing environment variables take precedence.
Open `http://localhost:3081/` (replace the port/path with your choices). Use two
browser windows, enter a display name and create/join the same room. After joining,
the address bar contains the invitation URL. Camera/microphone require HTTPS for
remote hosts; `localhost` works for development. Recording captures only the local
camera/microphone, not a composite meeting.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `HOST` | `127.0.0.1` | HTTP/WebSocket bind address; use the node VPN IP for a direct Edge upstream |
| `PORT` | `3081` | Shared HTTP/WebSocket TCP port (1–65535) |
| `BASE_PATH` | `/` | `/` for a dedicated domain; `/maia-meet/` for Apps; keep the trailing slash |
| `MAX_PARTICIPANTS` | `6` | Room limit; configurable from 1–20, mesh bandwidth increases with room size |
| `MAX_MESSAGE_BYTES` | `65536` | WebSocket payload limit |
| `RATE_LIMIT_MESSAGES` | `120` | Messages per connection per second, including ICE |
| `ALLOWED_ORIGINS` | empty | Optional comma-separated public origins, e.g. `https://apps.example.com`; empty allows any origin |
| `ICE_SERVERS` | Google STUN | JSON array of RTCIceServer objects, delivered on room join |
| `ICE_TRANSPORT_POLICY` | `all` | `all` or `relay` (requires TURN) |

Invalid ports, paths, room limits and malformed ICE configuration fail at startup.
`GET <BASE_PATH>health` reports HTTP availability and media mode.
Rooms are in memory and have no accounts/passwords; a room URL grants access.
Restarting Node ends signaling sessions. After a connection loss, the client
returns to the lobby and asks the user to rejoin.

### TURN and port ownership

For calls across NAT/restrictive networks, configure a reachable TURN service:

```dotenv
ICE_SERVERS='[{"urls":"stun:turn.example.com:3478"},{"urls":["turn:turn.example.com:3478?transport=udp","turns:turn.example.com:5349?transport=tcp"],"username":"meet-user","credential":"replace-with-user-credential"}]'
ICE_TRANSPORT_POLICY=all
```

Replace the host, ports and credentials with your TURN deployment values. These
are client credentials, visible to participants: do not put the TURN shared
signing secret here. Set `relay` to verify TURN independently of direct paths.
The TURN administrator chooses its listening ports and UDP relay range and opens
those in the TURN host/provider firewall. Browser ephemeral media ports are chosen
by the browser; `PORT` controls the Meet HTTP service, not those browser ports.
Maia Edge proxies HTTP/WebSocket and does not carry WebRTC UDP media automatically.

## systemd

Place the application at `/opt/maia-meet`, install Node dependencies with `npm ci`
in `signaling/`, create a service user `maia` with read access to the application,
and install the environment and unit files:

```bash
sudo install -d -m 0750 /etc/maia-meet
sudo install -m 0600 .env /etc/maia-meet/meet.env
sudo install -m 0644 deploy/maia-meet-signaling.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maia-meet-signaling
```

Edit the unit if the application path or service user differs. systemd reads
`/etc/maia-meet/meet.env`; changes to the checkout `.env` do not update it. Restart
the unit after changing the installed environment. Do not start the SFU for mesh.

## Maia Edge: dedicated domain

Reuse the existing VPN; no Edge source changes are required. For example, set
`HOST=10.77.0.2`, `PORT=3181`, `BASE_PATH=/` on the application node. Register the
upstream with the current Maia Edge CLI on the VPS:

```bash
sudo maia-edge service add meet.example.com proxy 10.77.0.2:3181 443 \
  /etc/letsencrypt/live/meet.example.com/fullchain.pem \
  /etc/letsencrypt/live/meet.example.com/privkey.pem
sudo maia-edge plan
sudo maia-edge apply
```

Replace the domain, VPN IP, application/public ports and certificate paths.
For an existing site managed by Maia Edge, change its record through the CLI;
do not edit its generated Nginx file. Restrict the application port to the VPN.
Certificates, DNS and the existing VPN must already be configured.

## Maia Apps: `/maia-meet/`

The sibling `maia-edge-apps-deployment` portal has a Meet card and its client
Nginx template includes `/etc/nginx/maia-apps.d/*.conf`. Meet is a Node service,
so it must not be installed by the static `www/` application loop.

1. Configure/run Meet with `HOST=127.0.0.1`, your chosen `PORT`, and
   `BASE_PATH=/maia-meet/` on the same node as the Apps Nginx server.
2. Generate the matching Nginx location from the same environment:

   ```bash
   cd signaling
   node --env-file=../.env ../deploy/render-nginx.mjs > /tmp/maia-meet.conf
   sudo install -d -m 0755 /etc/nginx/maia-apps.d
   sudo install -m 0644 /tmp/maia-meet.conf /etc/nginx/maia-apps.d/maia-meet.conf
   ```

3. In the existing Apps client server block, add this line if not already present:

   ```nginx
   include /etc/nginx/maia-apps.d/*.conf;
   ```

4. Run `sudo nginx -t` and reload Nginx. Publish the updated Apps portal using its
   existing deployment process. Open `https://apps.YOUR-DOMAIN/maia-meet/`.

The existing Apps VPS proxy forwards the complete path and WebSocket upgrade to
the client Nginx. Both hops preserve `/maia-meet/`; no public extra Meet port is
needed. The Apps frontend/VPN/public ports remain configured in their own Nginx
or Maia Edge settings. If your Apps site is generated by Maia Edge rather than
the Apps deployment template, use a dedicated Meet domain with the CLI above.

## Verification

```bash
make test                        # real HTTP/WebSocket lifecycle at / and /maia-meet/
cd signaling
npm install --no-save playwright
npx playwright install chromium
npm run test:browser              # 3 browsers, fake camera/mic, audio/video stats
NGINX_PATH=/usr/sbin/nginx npm run test:browser  # same call through two local proxies
```

The browser test covers audio/video reception, screen sharing, a late joiner,
camera restoration, chat without duplicates and leave/rejoin. It uses local ICE;
production DNS/TLS/VPN/TURN and cross-network calls still require deployment tests.

## Experimental native SFU

```bash
make install-system-deps
make sfu
```

The C++ executable reads environment variables directly (it does not load `.env`).
The optional SFU systemd unit reads the shared installed environment file.
`MAIA_CONTROL_BIND`/`MAIA_CONTROL_PORT` default to `127.0.0.1:3082`;
`MAIA_UDP_BIND` defaults to `0.0.0.0`; `MAIA_UDP_PORT_MIN`/`MAIA_UDP_PORT_MAX`
default to `10000`/`10100`. Ports are validated and the range is applied to
libjuice ICE sockets. Its control API is private and unauthenticated; keep it on
loopback. A successful build is not proof of a working SFU media path.

## Media app appearance

The Meet UI follows Maia Reel's dark palette, system/Inter font stack, violet
primary actions, panel borders and keyboard focus rings. The reference styles
are `maia-reel/apps/editor/style.css` and the sibling Apps repository's
`themes/maia-reel.css`. Meet keeps its responsive meeting layout in
`client/css/app.css`; it does not depend on a stylesheet served by another app.
When changing the shared media palette, update these local tokens as well.
The lobby, device preview and room were checked at 1440px and 390px, including
chat and meeting controls. The three-browser media test also passes with this UI.
