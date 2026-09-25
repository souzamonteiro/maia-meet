// Relative to this module: works at / and behind /maia-meet/ without rebuilding.
const endpoint = new URL('../ws', import.meta.url);
endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
export const signalingUrl = endpoint.href;
