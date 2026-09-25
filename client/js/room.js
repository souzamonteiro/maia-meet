export class RoomState {
    constructor() {
        this.localParticipantId = null;
        this.roomId = null;
        this.participants = new Map();
        this.videoTiles = new Map();
        this.listeners = new Map();
    }

    setLocalInfo(roomId, participantId) {
        this.roomId = roomId;
        this.localParticipantId = participantId;
    }

    addParticipant(participant) {
        this.participants.set(participant.id, participant);
        this.emit('participantAdded', participant);
    }

    removeParticipant(participantId) {
        if (this.participants.has(participantId)) {
            const participant = this.participants.get(participantId);
            this.participants.delete(participantId);
            this.emit('participantRemoved', participantId);
        }
    }

    getParticipant(participantId) {
        return this.participants.get(participantId);
    }
    
    getAllParticipants() {
        return Array.from(this.participants.values());
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            for (const cb of this.listeners.get(event)) {
                cb(data);
            }
        }
    }

    clear() {
        this.participants.clear();
        this.videoTiles.clear();
        this.localParticipantId = null;
        this.roomId = null;
    }
}
