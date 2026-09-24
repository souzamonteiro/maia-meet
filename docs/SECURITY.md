# Security Model

## Baseline

Production Maia Meet must use HTTPS/WSS. Browser WebRTC media uses DTLS-SRTP. Credentials, ICE parameters, SDP, room tokens and participant identifiers are treated as security-sensitive session data.

## Rules

- Never implement custom cryptographic algorithms.
- Use maintained implementations for DTLS and SRTP.
- Validate every network packet and signaling message.
- Bound all buffers, queues, caches and message sizes.
- Apply timeouts to ICE, DTLS and inactive sessions.
- Rate-limit room creation, joins, chat and negotiation.
- Generate room/session identifiers with a cryptographically secure RNG.
- Do not log authentication secrets, DTLS key material or full sensitive tokens.
- Run the SFU as an unprivileged service account.
- Restrict exposed UDP/TCP ports to the documented media/control ranges.
- Treat SDP as untrusted input.

## Privacy

Local recording is the default recording architecture: media is recorded in the participant's browser rather than uploaded automatically. The UI must make recording state explicit to the local user and should support meeting policy/consent indicators as the product evolves.

## E2EE note

DTLS-SRTP protects media on each browser-to-SFU hop. Because the SFU terminates those transports, this is not application-level end-to-end encryption between participants. True E2EE is a separate roadmap item and requires an encoded-media encryption design that preserves SFU routing capability.
