# Architecture Decision Records

Use this file as the initial ADR index. Split decisions into `docs/adr/NNNN-title.md` when implementation begins.

## ADR-0001 — No Jitsi dependency

**Decision:** Maia Meet is implemented independently and does not use Jitsi Meet, JVB, Jicofo, or Prosody.

**Reason:** control of architecture, smaller conceptual surface, reusable Maia infrastructure, and a framework-free browser client.

## ADR-0002 — Native C++ SFU

**Decision:** Maia SFU is a native Linux C++20 service, not WebAssembly.

**Reason:** it is a server-side high-throughput UDP/media router. WASM remains appropriate for optional client-side media processing.

## ADR-0003 — Node.js control plane

**Decision:** signaling, room control and text chat begin as a Node.js WebSocket service.

**Reason:** these workloads are control-plane oriented and benefit from simple asynchronous I/O and rapid iteration.

## ADR-0004 — Vanilla browser client

**Decision:** HTML, CSS and JavaScript ES modules; no React.

## ADR-0005 — Initial codecs

**Decision:** Opus audio and VP8 video form the initial interoperability target. Codec negotiation remains SDP-driven.

## Pending ADRs

- ICE library/implementation choice.
- DTLS integration architecture.
- SFU internal event loop library vs project-owned epoll implementation.
- signaling-to-SFU control protocol and transport.
- RTP header-extension support set.
- TURN deployment choice.
