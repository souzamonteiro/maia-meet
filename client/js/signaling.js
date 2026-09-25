export class SignalingClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.listeners = new Map();
        this.pendingRequests = new Map();
        this.isIntentionalClose = false;
    }

    connect() {
        this.isIntentionalClose = false;
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);
            const timer = setTimeout(() => { reject(new Error('Connection timed out')); this.disconnect(); }, 10000);
            this.ws.onopen = () => { clearTimeout(timer); resolve(); };
            this.ws.onerror = () => { clearTimeout(timer); reject(new Error('Could not connect to meeting server')); };
            this.ws.onmessage = event => {
                try { this.handleMessage(JSON.parse(event.data)); }
                catch (error) { console.error('Invalid signaling message', error); }
            };
            this.ws.onclose = () => {
                clearTimeout(timer);
                reject(new Error('Connection closed'));
                for (const request of this.pendingRequests.values()) {
                    clearTimeout(request.timeout);
                    request.reject(new Error('Connection closed'));
                }
                this.pendingRequests.clear();
                if (!this.isIntentionalClose) this.emit('disconnected', {});
            };
        });
    }

    disconnect() {
        this.isIntentionalClose = true;
        this.ws?.close();
    }

    on(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }

    off(type, handler) { this.listeners.get(type)?.delete(handler); }

    emit(type, data) {
        for (const handler of this.listeners.get(type) || []) handler(data);
    }

    send(type, payload = {}, requestId) {
        if (this.ws?.readyState !== WebSocket.OPEN) throw new Error('Connection is closed');
        this.ws.send(JSON.stringify({ version: 1, type, payload, requestId }));
    }

    sendRequest(type, payload = {}) {
        return new Promise((resolve, reject) => {
            const requestId = crypto.randomUUID();
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request ${type} timed out`));
            }, 10000);
            this.pendingRequests.set(requestId, { resolve, reject, timeout });
            try { this.send(type, payload, requestId); }
            catch (error) {
                clearTimeout(timeout);
                this.pendingRequests.delete(requestId);
                reject(error);
            }
        });
    }

    handleMessage({ type, requestId, payload }) {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            clearTimeout(request.timeout);
            this.pendingRequests.delete(requestId);
            if (type === 'error') request.reject(new Error(payload.message));
            else request.resolve(payload);
        }
        this.emit(type, payload);
    }
}
