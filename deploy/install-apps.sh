#!/usr/bin/env bash
# Prepare as the caller; only the final installation requires sudo.
set -Eeuo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=3081
DOMAIN=apps.maiaplatform.org
SITE=/etc/nginx/sites-available/apps.maiaplatform.org.conf
PREPARE_ONLY=0
EXTRA=()
while (($#)); do
    case "$1" in
        --port) PORT=${2:?Missing port}; shift 2 ;;
        --domain) DOMAIN=${2:?Missing domain}; shift 2 ;;
        --site) SITE=${2:?Missing site}; shift 2 ;;
        --dedicated) EXTRA+=(--dedicated); shift ;;
        --bind) EXTRA+=(--bind "${2:?Missing VPN IP}"); shift 2 ;;
        --meet-domain) EXTRA+=(--meet-domain "${2:?Missing Meet domain}"); shift 2 ;;
        --prepare-only) PREPARE_ONLY=1; shift ;;
        *) echo "Usage: bash $0 [--port 3081] [--domain apps.maiaplatform.org] [--site /etc/nginx/sites-available/apps.maiaplatform.org.conf] [--dedicated --bind 10.77.0.2 --meet-domain meet.maiaplatform.org] [--prepare-only]" >&2; exit 2 ;;
    esac
done
[[ $PORT =~ ^[0-9]+$ && ${#PORT} -le 5 ]] && ((10#$PORT >= 1 && 10#$PORT <= 65535)) || { echo 'Invalid port' >&2; exit 2; }
[[ $DOMAIN =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ ]] || { echo 'Invalid domain' >&2; exit 2; }
[[ $SITE == /* && -f $SITE ]] || { echo 'Apps nginx site not found' >&2; exit 2; }
/usr/bin/node -e 'if (+process.versions.node.split(".")[0] < 22) process.exit(1)' || { echo '/usr/bin/node 22+ is required' >&2; exit 1; }
[[ $EUID -ne 0 ]] || { echo 'Run this script as your normal user; it invokes sudo only after preparing dependencies.' >&2; exit 1; }
BUNDLE="$(mktemp -d /tmp/maia-meet-install.XXXXXXXX)"
chmod 0700 "$BUNDLE"
mkdir -p "$BUNDLE/release/signaling"
cp -a "$REPO/client" "$BUNDLE/release/"
cp -a "$REPO/signaling/src" "$BUNDLE/release/signaling/"
cp "$REPO/signaling/package.json" "$REPO/signaling/package-lock.json" "$BUNDLE/release/signaling/"
cp "$REPO/LICENSE" "$BUNDLE/release/"
cp "$REPO/deploy/install-apps.py" "$BUNDLE/install-apps.py"
if [[ -f "$REPO/.env" ]]; then cp "$REPO/.env" "$BUNDLE/meet.env"; else cp "$REPO/.env.example" "$BUNDLE/meet.env"; fi
chmod 0600 "$BUNDLE/meet.env"
npm ci --prefix "$BUNDLE/release/signaling" --omit=dev --ignore-scripts --no-audit --no-fund
python3 "$BUNDLE/install-apps.py" --bundle "$BUNDLE" --port "$PORT" --domain "$DOMAIN" --site "$SITE" "${EXTRA[@]}" --prepare
printf '\nPrepared installation: %s\n' "$BUNDLE"
if ((PREPARE_ONLY)); then
    printf 'Activate in your terminal:\nsudo python3 %q --bundle %q --port %q --domain %q --site %q' "$BUNDLE/install-apps.py" "$BUNDLE" "$PORT" "$DOMAIN" "$SITE"
    if ((${#EXTRA[@]})); then printf ' %q' "${EXTRA[@]}"; fi
    printf '\n'
else
    sudo python3 "$BUNDLE/install-apps.py" --bundle "$BUNDLE" --port "$PORT" --domain "$DOMAIN" --site "$SITE" "${EXTRA[@]}"
fi
