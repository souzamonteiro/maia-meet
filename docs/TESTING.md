# Testing Strategy

## Layers

1. **Unit tests** — RTP/RTCP parsing, sequence arithmetic, packet classification, state machines, JSON validation.
2. **Protocol tests** — recorded/generated RTP and RTCP vectors; malformed packet corpus.
3. **Browser interoperability** — automated Chromium sessions publishing/subscribing through Maia SFU.
4. **Network impairment** — latency, jitter, packet loss, reordering and bandwidth limits using Linux traffic control/netem.
5. **Load tests** — synthetic publishers/subscribers and packet forwarding throughput.
6. **Security tests** — fuzz parsers and signaling inputs; dependency scanning; sanitizer builds.

## Required development builds

- compiler warnings enabled and treated seriously;
- AddressSanitizer/UndefinedBehaviorSanitizer CI target;
- debug logging with participant/transport/SSRC correlation IDs;
- release build with assertions appropriate to production boundaries.

## First acceptance test

Three Chromium clients join the same room. Each publishes microphone and camera. Each client receives the other two participants with intelligible audio and moving video for at least 30 minutes without process restart or unbounded memory growth.
