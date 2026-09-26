# Public Meet domain through Maia Edge

Canonical URL: **https://meet.maiaplatform.org/**.
The Apps card opens this URL. The former Apps `/maia-meet/` route redirects here,
including its `?room=...` invitation query.

Topology:

```text
Browser -> VPS nginx :443 -> existing WireGuard VPN -> 10.77.0.2:3181
Apps card ------------------------------------------> public Meet URL
```

Node serves `/`, uses `HOST=10.77.0.2`, and permits the public Meet origin. These
scripts configure the HTTP/WebSocket path; WebRTC media connects directly or via
TURN. They do not change the WireGuard tunnel or configure TURN.

## 1. Install/update on the application machine

Run from this checkout as the normal user:

```bash
bash deploy/install-node.sh --port 3181 --bind 10.77.0.2
```

This invokes sudo only for activation. It installs a versioned release and system
service, preserves the installed ICE/TURN settings, configures the root base path,
and changes the old Apps route into a redirect. It uses the existing Apps Nginx
site and `maia` service account. Use `--prepare-only` to inspect the staged files.
Both `--port` and `--bind` are configurable. For a different public name, add
`--meet-domain meet.example.com` here and `--domain meet.example.com` on the VPS.

If UFW is active and blocks access, permit only the VPS over the existing tunnel
(adjust interface and VPN addresses to the actual installation):

```bash
sudo ufw allow in on wg0 proto tcp from 10.77.0.1 to 10.77.0.2 port 3181
```

Do not forward 3181 on the home router. The service binds to the VPN address.
From the VPS, this must return a healthy mesh status:

```bash
curl --fail http://10.77.0.2:3181/health
```

## 2. Run the VPS installer on the VPS

Copy **both** `deploy/install-vps.sh` and `deploy/install-vps.py` to the same
folder on the VPS (or transfer the checkout). No Node.js or SFU is needed there.
Nginx, OpenSSL, Python 3 and Certbot must be installed. On Ubuntu:

```bash
sudo apt-get update
sudo apt-get install nginx openssl python3 certbot
```

The DNS A record for `meet.maiaplatform.org` must point to the VPS, and inbound
TCP 80/443 must be allowed. The generated vhost listens on IPv4; do not publish
an AAAA record unless you separately enable and verify IPv6 on the VPS.

From the directory containing the two copied files:

```bash
bash install-vps.sh --dry-run
sudo bash install-vps.sh --upstream 10.77.0.2:3181
```

The first run asks for the Let's Encrypt contact email if a certificate does not
already exist. For unattended execution, pass `--email you@example.com`.
Existing certificates can be supplied with `--cert /absolute/fullchain.pem`
and `--key /absolute/privkey.pem` (both required together).

The script validates the backend health before making changes, then installs a
separate Meet Nginx vhost with WebSocket upgrades and timeouts. For certificate
issuance it temporarily serves the ACME challenge over HTTP, issues the
certificate with Certbot's webroot method, validates the certificate and Nginx,
and reloads Nginx. A renewal deploy hook validates/reloads Nginx. Verify that your
Certbot package has enabled its timer or equivalent renewal job:

```bash
systemctl list-timers certbot.timer
sudo certbot renew --dry-run
```

This vhost is owned by the Meet installer, not by Maia Edge's desired-state CLI.
It uses Maia Edge's existing VPN. **Do not also register the same domain with
`maia-edge service add`.** If the domain is already in another vhost (including a
Maia Edge managed file), the installer refuses to overwrite it; migrate/remove
that domain's old record first. Other Edge sites and VPN settings are preserved.

Nginx files are backed up under `/var/backups/maia-meet-vps/`. On failure the script
restores previous Nginx files and reloads; any issued certificates are retained.

## 3. Publish the Apps catalog link

On the application machine, from the sibling Apps deployment checkout:

```bash
cd /home/roberto/projects/maia-edge-apps-deployment
sudo bash scripts/client/publish-portal.sh
```

This publishes only the catalog HTML, robots and sitemap, with a backup. It does
not pull/reinstall other apps. The Meet card uses its explicit external URL; other
apps keep their existing local URLs. The external Meet URL is not inserted into
the Apps sitemap, which describes URLs hosted on the Apps domain.

## Verify with real devices

```bash
curl --fail https://meet.maiaplatform.org/health
```

Open the public domain, create one meeting and use **Copy invite** on the other
devices. Test an attendee without camera/microphone. Test different Internet
connections after configuring reachable TURN credentials in the node's installed
`/etc/maia-meet/meet.env` and restarting `maia-meet-signaling`.

Local regression: `node signaling/test/deployment.mjs` runs the generated VPS
HTTPS config in an isolated Nginx, verifies the HTTP redirect, assets and WSS room
join. It does not issue a real certificate, modify live services or certify
connectivity/firewalls on the real VPS.
