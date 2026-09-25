import config from './config.js';
import logger from './logger.js';

class SfuClient {
  constructor() {
    this.baseUrl = `http://${config.sfuHost}:${config.sfuPort}`;
  }

  async _request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {}
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`SFU returned ${response.status} ${response.statusText}`);
      }
      if (response.status !== 204 && response.headers.get('content-type')?.includes('application/json')) {
        return await response.json();
      }
      return null;
    } catch (error) {
      logger.error(`SFU request failed: ${method} ${path}`, error.message);
      throw error;
    }
  }

  async createTransport(conferenceId, participantId) {
    return this._request('POST', '/transports', { conferenceId, participantId });
  }

  async deleteTransport(transportId) {
    return this._request('DELETE', `/transports/${transportId}`);
  }

  async setRemoteDescription(transportId, sdp) {
    return this._request('POST', `/transports/${transportId}/remote-description`, { sdp });
  }

  async addIceCandidate(transportId, candidate, sdpMid, sdpMLineIndex) {
    return this._request('POST', `/transports/${transportId}/ice-candidate`, { candidate, sdpMid, sdpMLineIndex });
  }
}

export default new SfuClient();
