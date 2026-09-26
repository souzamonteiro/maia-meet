#!/usr/bin/env bash
# Dedicated public Meet domain over the existing Maia Edge VPN.
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/install-apps.sh" --port 3181 --dedicated "$@"
