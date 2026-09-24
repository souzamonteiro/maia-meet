# Development Guide

## Prerequisites

Target development environment: Ubuntu 24.04 LTS.

Expected tools:

- C++20 compiler (GCC or Clang)
- CMake
- Node.js LTS
- OpenSSL development package
- libsrtp development package
- browser with WebRTC developer tools

ICE dependency selection remains an explicit early task; do not silently lock the architecture to a library before the evaluation ADR.

## Build philosophy

Keep the C++ dependency graph small. Prefer system packages on Ubuntu for mature native libraries. CMake is used for the SFU build; npm is used only for the signaling service.

## Suggested first coding sequence

1. Implement signaling room creation/join and WebSocket presence.
2. Implement browser device preview/selection.
3. Implement SFU UDP socket/event loop and packet classifier.
4. Integrate ICE/STUN.
5. Integrate DTLS and derive SRTP contexts.
6. Receive/decrypt and inspect one browser RTP stream.
7. Add second browser and forward one media stream.
8. Add bidirectional publications/subscriptions.
9. Reach the three-browser acceptance test.

## Logging

Every media log line should make it possible to correlate at least:

`conferenceId`, `participantId`, `transportId`, and where relevant `ssrc`.

Do not log media payloads in normal operation.
