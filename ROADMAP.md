# Maia Meet Roadmap

The roadmap is milestone-driven rather than date-driven. A milestone is complete only when its acceptance criteria pass.

## M0 — Architecture and skeleton

- repository structure;
- architecture, protocol, security and test documentation;
- C++/CMake SFU skeleton;
- Node.js signaling skeleton;
- vanilla client skeleton;
- CI/build checks.

**Exit:** all components build/start and documentation establishes stable module boundaries.

## M1 — Rooms and local media

- create/join room;
- WebSocket connection and presence;
- camera/microphone permission flow;
- device enumeration/selection;
- local preview;
- mute and camera controls;
- text chat.

**Exit:** multiple clients can share room/presence/chat while previewing local media.

## M2 — First WebRTC transport

- SFU UDP/event loop;
- STUN/ICE integration;
- DTLS handshake;
- SRTP contexts;
- SDP negotiation;
- receive one Opus + VP8 publication;
- RTP/RTCP parser and basic stats.

**Exit:** Chromium publishes encrypted audio/video to Maia SFU and the SFU validates/decrypts RTP without decoding media.

## M3 — Selective forwarding

- publication/subscription model;
- outbound SRTP;
- RTP rewriting;
- RTCP basic forwarding;
- two-browser forwarding;
- three-browser full-room test.

**Exit:** three participants communicate through Maia SFU for 30 minutes.

## M4 — Reliability

- disconnect/reconnect behavior;
- ICE restart;
- RTCP PLI;
- Generic NACK;
- bounded retransmission cache;
- malformed-packet handling;
- metrics;
- sanitizer/fuzz testing;
- TURN-backed connectivity tests.

**Exit:** stable operation under moderate packet loss, jitter and reconnection scenarios.

## M5 — Product features

- screen sharing;
- local recording;
- recording layout/composition in browser where practical;
- participant list;
- copy invite link;
- active speaker indication;
- connection-quality UI;
- fullscreen/picture-in-picture where supported.

## M6 — Simulcast and bandwidth adaptation

- browser simulcast publication;
- RID/layer mapping;
- keyframe-aware layer switching;
- per-subscriber preferred layer;
- bandwidth/viewport-aware layer policy;
- congestion feedback strategy.

## M7 — Production hardening

- authentication/authorization hooks;
- moderated rooms;
- abuse/rate controls;
- operational dashboards;
- deployment automation;
- load/capacity characterization;
- compatibility matrix across major browsers.

## M8 — Scale-out

- SFU node registry/health;
- room placement;
- draining and graceful maintenance;
- multi-SFU architecture research;
- optional cascading only after measurement demonstrates the need.

## Future research

- encoded-transform E2EE;
- H.264/AV1;
- server-side recording as a separate recorder participant/service;
- transcription and meeting summaries using Maia AI components;
- live captions;
- noise suppression and other client-side WASM media processing;
- reusable Maia SFU API for applications beyond Maia Meet.
