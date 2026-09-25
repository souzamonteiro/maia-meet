#!/usr/bin/env bash
# Generates a self-signed TLS certificate for local HTTPS development.
# Output: deploy/certs/dev.crt and deploy/certs/dev.key
# The certificate covers localhost and 127.0.0.1.
#
# Usage: bash deploy/generate-dev-certs.sh
# Then configure nginx to use deploy/certs/dev.crt / deploy/certs/dev.key.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"

mkdir -p "${CERTS_DIR}"

CERT="${CERTS_DIR}/dev.crt"
KEY="${CERTS_DIR}/dev.key"

if [[ -f "${CERT}" && -f "${KEY}" ]]; then
    echo "Certificates already exist at ${CERTS_DIR}. Delete them to regenerate."
    exit 0
fi

# Subject Alternative Names for localhost development
SAN="subjectAltName=DNS:localhost,IP:127.0.0.1"

openssl req -x509 \
    -newkey rsa:2048 \
    -keyout "${KEY}" \
    -out "${CERT}" \
    -days 365 \
    -nodes \
    -subj "/CN=localhost/O=Maia Meet Dev/C=US" \
    -addext "${SAN}"

echo ""
echo "Generated:"
echo "  Certificate : ${CERT}"
echo "  Private key : ${KEY}"
echo ""
echo "To trust the certificate in Chrome/Chromium on Linux:"
echo "  1. Navigate to chrome://settings/certificates"
echo "  2. Import ${CERT} under 'Authorities'"
echo "  3. Check 'Trust this certificate for identifying websites'"
echo ""
echo "Alternatively, start Chrome with --ignore-certificate-errors-spki-list:"
echo "  FINGERPRINT=\$(openssl x509 -noout -fingerprint -sha256 -in ${CERT} | cut -d= -f2 | tr -d ':')"
echo "  chromium --ignore-certificate-errors-spki-list=\${FINGERPRINT}"

