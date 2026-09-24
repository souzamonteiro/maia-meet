# Maia Meet Signaling Protocol

## Principles

The signaling protocol is application-defined JSON over secure WebSocket. WebRTC does not prescribe the signaling transport. Every message has a `type`, protocol `version`, and where relevant `requestId`, `roomId`, and `participantId`.

## Envelope

```json
{
  "version": 1,
  "type": "room.join",
  "requestId": "req-123",
  "payload": {}
}
```

Unknown required fields or unsupported protocol versions must fail explicitly.

## Core messages

### `room.create`
Creates a room or requests a generated room identifier.

### `room.join`
Joins an existing room with a display name and client capabilities.

### `room.joined`
Returns participant identity, current participants and SFU/WebRTC configuration.

### `webrtc.offer` / `webrtc.answer`
Carries SDP during negotiation.

### `webrtc.iceCandidate`
Carries trickle ICE candidates.

### `track.published` / `track.unpublished`
Announces publication lifecycle.

### `track.subscribe` / `track.unsubscribe`
Expresses subscription intent. v0.1 may auto-subscribe to all remote tracks while retaining these messages in the model.

### `participant.joined` / `participant.left`
Presence events.

### `chat.send` / `chat.message`
Room text chat.

### `ping` / `pong`
Application heartbeat if needed in addition to WebSocket control frames.

## Example join

```json
{
  "version": 1,
  "type": "room.join",
  "requestId": "01J...",
  "payload": {
    "roomId": "abc-def-ghi",
    "displayName": "Alice",
    "capabilities": {
      "audio": ["opus"],
      "video": ["VP8"]
    }
  }
}
```

## Validation and limits

- Maximum JSON message size must be configured.
- Display names and chat messages have explicit length limits.
- Room IDs use a restricted character set.
- SDP and ICE messages are accepted only in valid participant/session states.
- Rate limits apply per connection/IP/account as appropriate.
- Never trust participant IDs supplied by a client after server assignment.
