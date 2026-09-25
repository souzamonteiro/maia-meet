# ADR-0007 — Signaling-to-SFU IPC: HTTP/JSON REST

**Status:** Accepted

**Date:** 2026-09-25

## Context

The signaling server (Node.js) must coordinate with Maia SFU (C++) to:

- Create and destroy WebRTC transports
- Forward SDP offers and receive SDP answers
- Forward ICE candidates

Options evaluated:

| Option | Notes |
|---|---|
| **HTTP/JSON REST on localhost** | Simple, language-agnostic, easy to debug |
| gRPC | Efficient binary protocol but adds protobuf toolchain to both Node and C++ |
| Unix domain socket + custom protocol | No toolchain overhead but requires custom framing |
| Shared memory / message queue | High performance but complex, premature optimization |

## Decision

For M1/M2: use a **simple HTTP/JSON REST API** served by the SFU on `127.0.0.1:3082`.

Endpoints:

| Method | Path | Description |
|---|---|---|
| POST | `/transports` | Create a WebRTC transport |
| DELETE | `/transports/:id` | Destroy a transport |
| POST | `/transports/:id/remote-description` | Set remote SDP |
| POST | `/transports/:id/ice-candidate` | Add ICE candidate |
| GET | `/health` | Health probe |

## Rationale

- Fastest to implement correctly; no schema compilation step
- Trivially debuggable with `curl`
- Localhost-only binding keeps it off the network
- The API surface is small; if latency ever matters, gRPC migration is straightforward
- Avoids adding protobuf/gRPC toolchain in the M0-M2 phase

## Consequences

- Transport creation adds one HTTP round-trip before the WebSocket join response; acceptable latency for a control-plane operation
- The SFU control port must never be exposed outside localhost
- Future evolution: replace with gRPC or Unix-socket protocol after single-node behavior is stable

