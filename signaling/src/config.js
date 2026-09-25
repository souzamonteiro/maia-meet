export function loadConfig(env = process.env) {
  const integer = (name, fallback, max = 65535) => {
    const raw = env[name] ?? String(fallback);
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > max) {
      throw new Error(`${name} must be an integer between 1 and ${max}`);
    }
    return Number(raw);
  };
  const basePath = env.BASE_PATH || '/';
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) {
    throw new Error('BASE_PATH must start and end with /, for example /maia-meet/');
  }
  let iceServers;
  try { iceServers = JSON.parse(env.ICE_SERVERS || '[{"urls":"stun:stun.l.google.com:19302"}]'); }
  catch { throw new Error('ICE_SERVERS must be a JSON array'); }
  if (!Array.isArray(iceServers) || iceServers.some(server => !server ||
      !(typeof server.urls === 'string' || (Array.isArray(server.urls) && server.urls.length)) ||
      [server.urls].flat().some(url => typeof url !== 'string' || !/^(stun|stuns|turn|turns):\S+$/.test(url)))) {
    throw new Error('ICE_SERVERS must contain valid STUN/TURN urls');
  }
  const iceTransportPolicy = env.ICE_TRANSPORT_POLICY || 'all';
  if (!['all', 'relay'].includes(iceTransportPolicy)) throw new Error('ICE_TRANSPORT_POLICY must be all or relay');
  if (iceTransportPolicy === 'relay' && !iceServers.some(s => [s.urls].flat().some(u => /^turns?:/.test(u)))) {
    throw new Error('Relay policy requires a TURN server');
  }
  return {
    host: env.HOST || '127.0.0.1',
    port: integer('PORT', 3081),
    basePath,
    maxMessageBytes: integer('MAX_MESSAGE_BYTES', 65536, 1048576),
    maxParticipants: integer('MAX_PARTICIPANTS', 6, 20),
    rateLimitTokens: integer('RATE_LIMIT_MESSAGES', 120, 10000),
    rateLimitInterval: 1000,
    rtcConfig: { iceServers, iceTransportPolicy },
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  };
}
export default loadConfig();
