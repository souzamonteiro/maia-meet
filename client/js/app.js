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

    document.getElementById('room-id').value = new URL(location.href).searchParams.get('room') || '';

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
    room.on('participantAdded', () => {
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
    const roomId = document.getElementById('room-id').value.trim();

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
    document.getElementById('btn-join-room').disabled = true;

    try {
        await devices.getLocalStream();
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
        UI.showNotification('Could not access camera/mic', 'error');
    }
}

function toggleMute() {
    isMuted = !isMuted;
    devices.setAudioMuted(isMuted);
    UI.setMuted(isMuted);
}

function toggleVideo() {
    isVideoEnabled = !isVideoEnabled;
    devices.setVideoEnabled(isVideoEnabled);
    UI.setCameraEnabled(isVideoEnabled);
}

async function onJoinRoom() {
    if (!devices.localStream) return;
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
