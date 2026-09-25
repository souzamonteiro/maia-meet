export class Participant {
  constructor({ id, roomId, displayName, sessionId, socket }) {
    this.id = id;
    this.roomId = roomId;
    this.displayName = displayName;
    this.sessionId = sessionId;
    this.socket = socket;
    this.connectionState = 'new';
    this.transportId = null;
    this.publications = new Map();
    this.subscriptions = new Map();
  }

  toJSON() {
    return {
      id: this.id,
      displayName: this.displayName,
      connectionState: this.connectionState
    };
  }
}
