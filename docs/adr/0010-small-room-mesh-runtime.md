# ADR 0010: Use mesh for the first working small-room runtime

Status: accepted for the pre-alpha runtime; SFU remains the target architecture.

The native SFU currently creates a fixed SDP answer without negotiated mids,
rtcp-mux or candidate delivery. Its HTTP transport creation does not attach
participants/publications to the conference router. Building successfully and
returning a healthy control endpoint cannot establish a browser conference.

Use one browser RTCPeerConnection per remote participant for small meetings.
The newcomer offers to existing members, avoiding simultaneous initial offers.
Signaling validates membership before relaying SDP/ICE and supplies operator
STUN/TURN configuration. The Node server serves both assets and WebSocket on one
configurable port, with a configurable path for the Maia Apps reverse proxy.

Mesh increases each participant's upload with room size; default to six members.
TURN is required for reliable connectivity across restrictive networks. Keep the
native code as explicitly experimental work and require a real browser media
acceptance test before switching the default runtime to SFU. The current browser
test validates mesh, including through two local Nginx hops; it is not the planned
30-minute SFU acceptance test or a production VPN/TURN deployment test.
