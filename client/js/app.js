import { signalingUrl } from './config.js';
import { SignalingClient } from './signaling.js';
import { DeviceManager } from './devices.js';
import { WebRtcSession } from './webrtc.js';
import { RoomState } from './room.js';
import { UI } from './ui.js';
import { ChatManager } from './chat.js';

let signaling;
let devices;
let webrtc;
let room;
let chat;

let currentDisplayName = '';
let currentRoomId = '';
let isMuted = false;
let isVideoEnabled = true;
let isRecording = false;

// Initialize app
async function init() {
    devices = new DeviceManager();
    room = new RoomState();
    chat = new ChatManager();

    const invitedRoom = new URL(location.href).searchParams.get('room') || '';
    document.getElementById('room-id').value = invitedRoom;
    if (invitedRoom) {
        document.getElementById('btn-new-meeting').hidden = true;
        document.getElementById('lobby-description').textContent = `Join meeting ${invitedRoom}. Enter your name below.`;
    }
    document.getElementById('btn-join-without-devices').addEventListener('click', () => {
        devices.stopLocalPreview();
        onJoinRoom();
    });
    document.getElementById('btn-copy-invite').addEventListener('click', async () => {
        const input = document.getElementById('meeting-link');
        try { await navigator.clipboard.writeText(input.value); UI.showNotification('Invitation link copied'); }
        catch { input.focus(); input.select(); UI.showNotification('Copy the selected invitation link'); }
    });

    // Lobby events
    document.getElementById('btn-new-meeting').addEventListener('click', onNewMeeting);
    document.getElementById('btn-join-lobby').addEventListener('click', onJoinLobbyClick);

    // Preview events
    document.getElementById('btn-back-preview').addEventListener('click', () => {
        devices.stopLocalPreview();
        UI.showView('lobby');
    });
    document.getElementById('btn-join-room').addEventListener('click', onJoinRoom);
    document.getElementById('btn-toggle-preview-mic').addEventListener('click', toggleMute);
    document.getElementById('btn-toggle-preview-cam').addEventListener('click', toggleVideo);

    document.getElementById('camera-select').addEventListener('change', async (e) => {
        await devices.setCamera(e.target.value);
        devices.setVideoEnabled(isVideoEnabled);
    });
    document.getElementById('mic-select').addEventListener('change', async (e) => {
        await devices.setMicrophone(e.target.value);
        devices.setAudioMuted(isMuted);
    });

    // Room toolbar events
    document.getElementById('btn-toggle-mic').addEventListener('click', toggleMute);
    document.getElementById('btn-toggle-cam').addEventListener('click', toggleVideo);
    document.getElementById('btn-leave').addEventListener('click', leaveRoom);

    document.getElementById('btn-toggle-chat').addEventListener('click', () => UI.togglePanel('chat-panel'));
    document.getElementById('btn-toggle-participants').addEventListener('click', () => UI.togglePanel('participants-panel'));

    document.getElementById('btn-toggle-screen').addEventListener('click', toggleScreenShare);
    document.getElementById('btn-toggle-record').addEventListener('click', toggleRecording);

    // Chat events
    document.getElementById('btn-send-chat').addEventListener('click', sendChat);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });

    // Room state events
    room.on('participantAdded', participant => {
        if (participant.id !== room.localParticipantId && !document.getElementById(`tile-${participant.id}`)) {
            UI.createVideoTile(participant.id, participant.displayName, null);
        }
        UI.updateParticipantsList(room.getAllParticipants());
    });
    room.on('participantRemoved', (id) => {
        UI.removeVideoTile(id);
        UI.updateParticipantsList(room.getAllParticipants());
    });
}

function generateRoomId() {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

async function onNewMeeting() {
    const name = document.getElementById('display-name').value.trim();
    if (!name) return UI.showNotification('Please enter a display name', 'error');

    const roomId = generateRoomId();
    document.getElementById('room-id').value = roomId;

    await setupPreview(name, roomId);
}

async function onJoinLobbyClick() {
    const name = document.getElementById('display-name').value.trim();
    let roomId = document.getElementById('room-id').value.trim();
    if (/^https?:\/\//.test(roomId)) {
        try { roomId = new URL(roomId).searchParams.get('room') || ''; } catch { roomId = ''; }
    }

    if (!name) return UI.showNotification('Please enter a display name', 'error');
    if (!roomId) return UI.showNotification('Please enter a room ID', 'error');

    await setupPreview(name, roomId);
}

async function setupPreview(name, roomId) {
    if (!/^[a-zA-Z0-9]{3,32}$/.test(roomId)) return UI.showNotification('Room ID must contain 3–32 letters or numbers', 'error');
    if (!window.isSecureContext || !navigator.mediaDevices) return UI.showNotification('Use HTTPS (or localhost) to access the camera and microphone', 'error');
    currentDisplayName = name;
    currentRoomId = roomId;

    UI.showView('preview');
    const invite = new URL(location.href);
    invite.searchParams.set('room', currentRoomId);
    history.replaceState(null, '', invite);
    document.getElementById('meeting-link').value = invite.href;
    document.getElementById('meeting-room-id').textContent = currentRoomId;
    document.getElementById('btn-join-room').disabled = false;
    document.getElementById('device-status').textContent = 'Camera and microphone are optional. You can join while permission is pending.';

    if (document.getElementById('join-as-viewer').checked) {
        devices.stopLocalPreview();
        isMuted = true;
        isVideoEnabled = false;
        UI.setMuted(true);
        UI.setCameraEnabled(false);
        document.getElementById('device-status').textContent = 'You will join without camera or microphone. You can enable them during the meeting.';
        return;
    }
    try {
        await devices.getLocalStream();
        if (!document.getElementById('view-preview').classList.contains('active')) return;
        isMuted = !devices.localStream.getAudioTracks().length;
        isVideoEnabled = !!devices.localStream.getVideoTracks().length;
        UI.setMuted(isMuted);
        UI.setCameraEnabled(isVideoEnabled);
        document.getElementById('device-status').textContent = 'You can join with the available devices, or without camera and microphone.';
        devices.setAudioMuted(isMuted);
        devices.setVideoEnabled(isVideoEnabled);
        document.getElementById('btn-join-room').disabled = false;
        const { cameras, microphones } = await devices.enumerateDevices();
        UI.populateDeviceSelectors(cameras, microphones);

        devices.startLocalPreview(document.getElementById('local-preview-video'));

        // Update audio level
        const updateAudio = () => {
            const level = devices.getAudioLevel();
            document.getElementById('audio-level-bar').style.height = `${level}%`;
            devices.animationFrameId = requestAnimationFrame(updateAudio);
        };
        updateAudio();

    } catch (err) {
        document.getElementById('device-status').textContent = 'Devices unavailable. You can still join and watch the meeting.';
    }
}

async function toggleMute() {
    try {
        let track = devices.localStream.getAudioTracks()[0];
        if (!track) {
            track = await devices.acquireTrack('audio');
            if (webrtc) await webrtc.replaceTrack(null, track);
            isMuted = false;
        } else isMuted = !isMuted;
        devices.setAudioMuted(isMuted);
        UI.setMuted(isMuted);
    } catch { UI.showNotification('Microphone unavailable. You can continue listening.', 'error'); }
}

async function toggleVideo() {
    try {
        let track = devices.localStream.getVideoTracks()[0];
        if (!track) {
            track = await devices.acquireTrack('video');
            if (webrtc && !devices.screenStream) await webrtc.replaceTrack(null, track);
            isVideoEnabled = true;
        } else isVideoEnabled = !isVideoEnabled;
        devices.setVideoEnabled(isVideoEnabled);
        UI.setCameraEnabled(isVideoEnabled);
        document.getElementById('local-preview-video').srcObject = devices.localStream;
    } catch { UI.showNotification('Camera unavailable. You can continue watching.', 'error'); }
}

async function onJoinRoom() {
    devices.cancelPendingCapture();
    isMuted = !devices.localStream.getAudioTracks().some(t => t.enabled);
    isVideoEnabled = devices.localStream.getVideoTracks().some(t => t.enabled);
    UI.setMuted(isMuted);
    UI.setCameraEnabled(isVideoEnabled);
    if (devices.animationFrameId) cancelAnimationFrame(devices.animationFrameId);
    UI.showView('room');
    UI.createVideoTile('local', `${currentDisplayName} (You)`, devices.localStream, true);
    signaling = new SignalingClient(signalingUrl);
    setupSignalingHandlers();
    try {
        await signaling.connect();
        const res = await signaling.sendRequest('room.join', {
            roomId: currentRoomId, displayName: currentDisplayName
        });
        room.setLocalInfo(currentRoomId, res.participantId);
        res.participants.forEach(p => room.addParticipant(p));
        webrtc = new WebRtcSession(signaling, res.rtcConfig);
        webrtc.onError = error => UI.showNotification(error.message, 'error');
        webrtc.onRemoteTrack = (track, stream, id) => {
            if (!document.getElementById(`tile-${id}`)) {
                UI.createVideoTile(id, room.getParticipant(id)?.displayName || 'Participant', stream);
            } else UI.updateVideoTile(id, stream);
        };
        // Separate stream container preserves the camera track while sharing a screen.
        await webrtc.start(new MediaStream(devices.localStream.getTracks()),
            res.participants.filter(p => p.id !== res.participantId));
        const url = new URL(location.href);
        url.searchParams.set('room', currentRoomId);
        history.replaceState(null, '', url);
        UI.showNotification(`Joined room ${currentRoomId}. Share this page URL to invite people.`, 'success');
    } catch (err) {
        UI.showNotification(err.message || 'Failed to join room', 'error');
        leaveRoom();
    }
}

function setupSignalingHandlers() {
    signaling.on('participant.joined', ({ participant }) => {
        room.addParticipant(participant);
        UI.showNotification(`${participant.displayName} joined`);
    });
    signaling.on('participant.left', ({ participantId }) => {
        webrtc?.removePeer(participantId);
        room.removeParticipant(participantId);
    });
    signaling.on('chat.message', payload => chat.appendMessage(payload));
    signaling.on('error', payload => UI.showNotification(payload.message, 'error'));
    signaling.on('disconnected', () => {
        leaveRoom();
        UI.showNotification('Connection lost. Join the meeting again.', 'error');
    });
}

async function stopScreenShare() {
    const screenTrack = devices.screenStream?.getVideoTracks()[0];
    if (!screenTrack) return;
    screenTrack.onended = null;
    await webrtc.replaceTrack(screenTrack, devices.localStream.getVideoTracks()[0]);
    devices.stopScreenShare();
    UI.updateVideoTile('local', devices.localStream);
}

async function toggleScreenShare() {
    try {
        if (devices.screenStream) { await stopScreenShare(); return; }
        const stream = await devices.startScreenShare();
        if (!stream) return;
        const screenTrack = stream.getVideoTracks()[0];
        await webrtc.replaceTrack(devices.localStream.getVideoTracks()[0], screenTrack);
        UI.updateVideoTile('local', stream);
        screenTrack.onended = () => stopScreenShare().catch(error => UI.showNotification(error.message, 'error'));
    } catch (error) { UI.showNotification(error.message, 'error'); }
}

function toggleRecording() {
    if (isRecording) {
        devices.stopRecording();
        isRecording = false;
        UI.setRecording(false);
    } else {
        if (!devices.localStream.getTracks().length) { UI.showNotification('No local media to record. Enable a camera or microphone first.'); return; }
        // Just record local stream for this demo, or we could record a composite canvas
        devices.startRecording(devices.localStream);
        isRecording = true;
        UI.setRecording(true);
        UI.showNotification('Recording started', 'info');
    }
}

function sendChat() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !signaling) return;

    signaling.send('chat.send', { text });

    input.value = '';
}

function leaveRoom() {
    if (webrtc) webrtc.close();
    webrtc = null;
    if (signaling) signaling.disconnect();
    devices.stopLocalPreview();
    devices.stopScreenShare();
    devices.stopRecording();

    room.clear();
    UI.updateParticipantsList([]);
    chat.clear();
    document.getElementById('video-grid').innerHTML = '';

    UI.showView('lobby');

    // reset state
    isMuted = false;
    isVideoEnabled = true;
    isRecording = false;
    UI.setMuted(false);
    UI.setCameraEnabled(true);
    UI.setRecording(false);
}

// Start
document.addEventListener('DOMContentLoaded', init);
