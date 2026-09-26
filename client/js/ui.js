export const UI = {
    showView(viewId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');
    },

    createVideoTile(participantId, displayName, stream, isLocal = false) {
        const grid = document.getElementById('video-grid');
        
        const tile = document.createElement('div');
        tile.className = 'video-tile';
        if (isLocal) tile.classList.add('local');
        tile.id = `tile-${participantId}`;

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        if (isLocal) video.muted = true;
        if (stream) {
            video.srcObject = stream;
        }

        const nameLabel = document.createElement('div');
        nameLabel.className = 'participant-name';
        nameLabel.textContent = displayName || participantId;

        tile.appendChild(video);
        if (!isLocal) {
            const play = document.createElement('button');
            play.className = 'media-play';
            play.textContent = 'Play audio and video';
            play.hidden = true;
            const startPlayback = () => video.play().catch(() => { play.hidden = false; });
            video.addEventListener('loadedmetadata', startPlayback);
            video.addEventListener('play', () => { play.hidden = true; });
            play.addEventListener('click', startPlayback);
            tile.appendChild(play);
        }
        tile.appendChild(nameLabel);
        grid.appendChild(tile);

        return tile;
    },

    removeVideoTile(participantId) {
        const tile = document.getElementById(`tile-${participantId}`);
        if (tile) {
            tile.remove();
        }
    },

    updateVideoTile(participantId, stream) {
        const tile = document.getElementById(`tile-${participantId}`);
        if (tile) {
            const video = tile.querySelector('video');
            if (video) {
                video.srcObject = stream;
            }
        }
    },

    setActiveSpeaker(participantId) {
        document.querySelectorAll('.video-tile').forEach(t => t.classList.remove('active-speaker'));
        if (participantId) {
            const tile = document.getElementById(`tile-${participantId}`);
            if (tile) {
                tile.classList.add('active-speaker');
            }
        }
    },

    showNotification(text, type = 'info') {
        const container = document.getElementById('notifications');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = text;
        if (type === 'error') {
            toast.style.borderColor = 'var(--danger)';
            toast.style.color = 'var(--danger)';
        } else if (type === 'success') {
            toast.style.borderColor = 'var(--success)';
            toast.style.color = 'var(--success)';
        }

        container.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    setMuted(muted) {
        const btn = document.getElementById('btn-toggle-mic');
        const previewBtn = document.getElementById('btn-toggle-preview-mic');
        btn.setAttribute('aria-pressed', String(muted));
        previewBtn.setAttribute('aria-pressed', String(muted));
        btn.setAttribute('aria-label', muted ? 'Unmute microphone' : 'Mute microphone');
        if (muted) {
            btn.classList.add('muted');
            btn.textContent = 'Unmute';
            previewBtn.classList.add('muted');
            previewBtn.textContent = 'Unmute microphone';
        } else {
            btn.classList.remove('muted');
            btn.textContent = 'Microphone';
            previewBtn.classList.remove('muted');
            previewBtn.textContent = 'Mute microphone';
        }
    },

    setCameraEnabled(enabled) {
        const btn = document.getElementById('btn-toggle-cam');
        const previewBtn = document.getElementById('btn-toggle-preview-cam');
        btn.setAttribute('aria-pressed', String(!enabled));
        previewBtn.setAttribute('aria-pressed', String(!enabled));
        btn.setAttribute('aria-label', enabled ? 'Turn camera off' : 'Turn camera on');
        if (!enabled) {
            btn.classList.add('muted');
            btn.textContent = 'Camera off';
            previewBtn.classList.add('muted');
            previewBtn.textContent = 'Turn camera on';
        } else {
            btn.classList.remove('muted');
            btn.textContent = 'Camera';
            previewBtn.classList.remove('muted');
            previewBtn.textContent = 'Turn camera off';
        }
    },

    setRecording(recording) {
        const btn = document.getElementById('btn-toggle-record');
        btn.textContent = recording ? 'Stop recording' : 'Record locally';
        btn.setAttribute('aria-label', btn.textContent);
        btn.setAttribute('aria-pressed', String(recording));
        if (recording) {
            btn.classList.add('recording');
        } else {
            btn.classList.remove('recording');
        }
    },

    populateDeviceSelectors(cameras, microphones) {
        const camSelect = document.getElementById('camera-select');
        const micSelect = document.getElementById('mic-select');
        
        camSelect.innerHTML = '';
        cameras.forEach(cam => {
            const opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.label || `Camera ${camSelect.length + 1}`;
            camSelect.appendChild(opt);
        });

        micSelect.innerHTML = '';
        microphones.forEach(mic => {
            const opt = document.createElement('option');
            opt.value = mic.deviceId;
            opt.textContent = mic.label || `Microphone ${micSelect.length + 1}`;
            micSelect.appendChild(opt);
        });
    },

    getSelectedCamera() {
        return document.getElementById('camera-select').value;
    },

    getSelectedMic() {
        return document.getElementById('mic-select').value;
    },
    
    updateParticipantsList(participants) {
        const list = document.getElementById('participants-list');
        list.innerHTML = '';
        participants.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.displayName || p.id;
            li.style.padding = '0.5rem';
            li.style.borderBottom = '1px solid var(--border)';
            list.appendChild(li);
        });
    },
    
    togglePanel(panelId) {
        const sidebar = document.getElementById('sidebar-panel');
        const panels = document.querySelectorAll('.panel');
        
        const targetPanel = document.getElementById(panelId);
        
        if (sidebar.classList.contains('open') && targetPanel.classList.contains('active')) {
            // Close if clicking same panel
            sidebar.classList.remove('open');
            setTimeout(() => {
                panels.forEach(p => p.classList.remove('active'));
            }, 300);
        } else {
            panels.forEach(p => p.classList.remove('active'));
            targetPanel.classList.add('active');
            sidebar.classList.add('open');
        }
    }
};
