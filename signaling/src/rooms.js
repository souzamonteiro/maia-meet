import crypto from 'crypto';
import logger from './logger.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId) {
    if (!roomId) {
      roomId = crypto.randomBytes(4).toString('hex');
    }
    this.rooms.set(roomId, new Map());
    logger.info(`Created room ${roomId}`);
    return roomId;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, participant) {
    let room = this.rooms.get(roomId);
    if (!room) {
      return false;
    }
    room.set(participant.id, participant);
    logger.info(`Participant ${participant.id} joined room ${roomId}`);
    return true;
  }

  leaveRoom(roomId, participantId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(participantId);
      logger.info(`Participant ${participantId} left room ${roomId}`);
      if (room.size === 0) {
        this.rooms.delete(roomId);
        logger.info(`Deleted empty room ${roomId}`);
      }
    }
  }

  getParticipants(roomId) {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.values()) : [];
  }
  
  broadcast(roomId, message, excludeParticipantId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify(message);
    for (const [id, participant] of room.entries()) {
      if (id !== excludeParticipantId && participant.socket.readyState === 1 /* WebSocket.OPEN */) {
        participant.socket.send(data);
      }
    }
  }
}

export default new RoomManager();
