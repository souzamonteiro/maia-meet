// Small-room mesh: the newcomer offers to existing participants. Each peer has
// a serial signaling queue so ICE arriving during setRemoteDescription is safe.
export class WebRtcSession {
    constructor(signalingClient, config) {
        this.signaling = signalingClient;
        this.config = config;
        this.peers = new Map();
        this.queues = new Map();
        this.departed = new Set();
        this.localStream = null;
        this.onRemoteTrack = null;
        this.onError = error => console.error(error);
        this.closed = false;
        this.handlers = [];
        for (const type of ['webrtc.offer', 'webrtc.answer', 'webrtc.iceCandidate']) {
            const handler = payload => this.enqueue(payload.participantId, () => this.handle(type, payload));
            this.signaling.on(type, handler);
            this.handlers.push([type, handler]);
        }
    }

    peer(id) {
        if (this.closed || this.departed.has(id)) throw new Error('Peer has left');
        if (this.peers.has(id)) return this.peers.get(id);
        const pc = new RTCPeerConnection(this.config);
        const peer = { pc, candidates: [], stream: new MediaStream() };
        this.peers.set(id, peer);
        for (const track of this.localStream?.getTracks() || []) pc.addTrack(track, this.localStream);
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && !this.closed) this.signaling.send('webrtc.iceCandidate', { targetId: id, ...candidate.toJSON() });
        };
        pc.ontrack = ({ track }) => {
            peer.stream.addTrack(track);
            this.onRemoteTrack?.(track, peer.stream, id);
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed') this.onError(new Error('Media connection failed. Check the TURN configuration.'));
        };
        return peer;
    }

    enqueue(id, operation) {
        const next = (this.queues.get(id) || Promise.resolve()).then(() => {
            if (!this.closed && !this.departed.has(id)) return operation();
        }).catch(error => { if (!this.closed && !this.departed.has(id)) this.onError(error); });
        this.queues.set(id, next);
        return next;
    }

    async start(localStream, participants = []) {
        this.localStream = localStream;
        await Promise.all(participants.map(p => this.enqueue(p.id, async () => {
            const { pc } = this.peer(p.id);
            await pc.setLocalDescription(await pc.createOffer());
            this.signaling.send('webrtc.offer', { targetId: p.id, sdp: pc.localDescription.sdp });
        })));
    }

    async handle(type, payload) {
        const peer = this.peer(payload.participantId);
        const { pc } = peer;
        if (type === 'webrtc.iceCandidate') {
            const candidate = { candidate: payload.candidate, sdpMid: payload.sdpMid, sdpMLineIndex: payload.sdpMLineIndex };
            if (pc.remoteDescription) await pc.addIceCandidate(candidate);
            else peer.candidates.push(candidate);
            return;
        }
        await pc.setRemoteDescription({ type: type === 'webrtc.offer' ? 'offer' : 'answer', sdp: payload.sdp });
        for (const candidate of peer.candidates.splice(0)) await pc.addIceCandidate(candidate);
        if (type === 'webrtc.offer') {
            await pc.setLocalDescription(await pc.createAnswer());
            this.signaling.send('webrtc.answer', { targetId: payload.participantId, sdp: pc.localDescription.sdp });
        }
    }

    async replaceTrack(oldTrack, newTrack) {
        await Promise.all([...this.peers.values()].map(async ({ pc }) => {
            const sender = pc.getSenders().find(s => s.track === oldTrack);
            if (sender) await sender.replaceTrack(newTrack);
        }));
        // Newcomers must receive the currently published track too.
        if (this.localStream && oldTrack) this.localStream.removeTrack(oldTrack);
        if (this.localStream && newTrack) this.localStream.addTrack(newTrack);
    }

    removePeer(id) {
        this.departed.add(id);
        this.peers.get(id)?.pc.close();
        this.peers.delete(id);
        this.queues.delete(id);
    }

    close() {
        this.closed = true;
        for (const [type, handler] of this.handlers) this.signaling.off(type, handler);
        for (const { pc } of this.peers.values()) pc.close();
        this.peers.clear();
        this.queues.clear();
    }
}
