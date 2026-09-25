# ADR-0009 — SFU HTTP Control Server: cpp-httplib

**Status:** Accepted

**Date:** 2026-09-25

## Context

The SFU control API requires an HTTP server that listens on localhost. Since this is a control-plane interface (low volume, simple REST), the server needs to be:
- Easy to embed in a C++ process
- No dependency on a separate framework runtime
- Sufficient for synchronous request/response over localhost

Options evaluated:

| Option | Style | Notes |
|---|---|---|
| **cpp-httplib** | Header-only | Single header, MIT, well-tested, HTTPS support via OpenSSL |
| Boost.Beast | Heavy | Large Boost dependency, complex async API |
| Crow | Framework | Good but more setup; separate compilation unit |
| Raw POSIX sockets | None | High maintenance, error-prone |
| libmicrohttpd | System library | C library, requires system package |

## Decision

Use **cpp-httplib** (https://github.com/yhirose/cpp-httplib) at a pinned tag via CMake FetchContent.

## Rationale

- Single header, zero external dependencies beyond OpenSSL (already required for DTLS)
- MIT license
- Synchronous request handling fits the control-plane model — no async complexity needed here
- HTTPS mode available if the control API ever needs to move off localhost
- Well-maintained; used in production systems

## Consequences

- The control HTTP server runs on a dedicated thread (synchronous blocking)
- Not suitable for high-throughput APIs, but the control plane never approaches that
- If the control API moves to gRPC in a future ADR, cpp-httplib is simply removed

