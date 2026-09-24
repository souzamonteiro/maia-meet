# Core Data Model

## Control plane

```mermaid
classDiagram
    class Room {
        id
        createdAt
        participants : Map~ParticipantId, Participant~
        sfuNodeId
    }
    class Participant {
        id
        roomId
        displayName
        sessionId
        connectionState
        publications
        subscriptions
    }
    class Publication {
        id
        participantId
        kind : audio | video
        source : microphone | camera | screen
        codec
        layers[]
    }
    class Subscription {
        id
        participantId
        publicationId
        preferredLayer
    }
    Room "1" --> "0..*" Participant : participants
    Participant "1" --> "0..*" Publication : publications
    Participant "1" --> "0..*" Subscription : subscriptions
    Subscription "0..*" --> "1" Publication : publicationId
```

## SFU media plane

Suggested C++ ownership model:

```mermaid
flowchart LR
    server["SfuServer"] --- manager["ConferenceManager"]
    manager --- conference["Conference"]
    conference --- participant["Participant"]
    participant --- transport["WebRtcTransport"]
    participant --- publication["Publication*"]
    participant --- subscription["Subscription*"]
    transport --- ice["IceTransport"]
    transport --- dtls["DtlsTransport"]
    transport --- srtp["SrtpContext"]
    transport --- receivers["RtpReceiver(s)"]
    transport --- senders["RtpSender(s)"]
    publication --- source["SourceStream(s)"]
    publication --- subscribers["Subscriber list"]
    source --- mapping["SSRC/MID/RID mapping"]
    source --- rtpStats["RTP statistics"]
    source --- cache["PacketCache"]
    subscription --- rewriter["RtpRewriter"]
    subscription --- selected["Selected source/layer"]
    subscription --- outboundStats["Outbound statistics"]
```

Use stable opaque IDs at component boundaries. Do not expose C++ pointers or process-local numeric indexes in the signaling protocol.
