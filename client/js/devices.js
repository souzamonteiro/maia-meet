export class DeviceManager {
    constructor() {
        this.localStream = new MediaStream();
        this.captureVersion = 0;
        this.screenStream = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphoneSource = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.animationFrameId = null;
    }

    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(d => d.kind === 'videoinput');
            const microphones = devices.filter(d => d.kind === 'audioinput');
            
            return { cameras, microphones };
        } catch (err) {
            console.error('Error enumerating devices:', err);
            return { cameras: [], microphones: [] };
        }
    }

    async getLocalStream() {
        const version = ++this.captureVersion;
        const results = await Promise.allSettled(['audio', 'video'].map(kind =>
            navigator.mediaDevices.getUserMedia({ [kind]: true })));
        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            for (const track of result.value.getTracks()) {
                if (version !== this.captureVersion) track.stop();
                else this.localStream.addTrack(track);
            }
        }
        return this.localStream;
    }

    cancelPendingCapture() { this.captureVersion++; }

    async acquireTrack(kind) {
        const version = this.captureVersion;
        const stream = await navigator.mediaDevices.getUserMedia({ [kind]: true });
        if (version !== this.captureVersion) {
            stream.getTracks().forEach(track => track.stop());
            throw new Error('Device request cancelled');
        }
        const track = stream.getTracks()[0];
        this.localStream.addTrack(track);
        return track;
    }

    async setCamera(deviceId) {
        if (!this.localStream) return null;
        
        const constraints = { video: { deviceId: { exact: deviceId } } };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
            this.localStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
        }
        this.localStream.addTrack(newVideoTrack);
        return newVideoTrack;
    }

    async setMicrophone(deviceId) {
        if (!this.localStream) return null;
        
        const constraints = { audio: { deviceId: { exact: deviceId } } };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        const newAudioTrack = newStream.getAudioTracks()[0];
        
        const oldAudioTrack = this.localStream.getAudioTracks()[0];
        if (oldAudioTrack) {
            this.localStream.removeTrack(oldAudioTrack);
            oldAudioTrack.stop();
        }
        this.localStream.addTrack(newAudioTrack);
        
        this.setupAudioLevelIndicator(this.localStream);
        return newAudioTrack;
    }

    startLocalPreview(videoEl) {
        if (this.localStream && videoEl) {
            videoEl.srcObject = this.localStream;
            this.setupAudioLevelIndicator(this.localStream);
        }
    }

    stopLocalPreview() {
        this.cancelPendingCapture();
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = new MediaStream();
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    setupAudioLevelIndicator(stream) {
        if (!stream.getAudioTracks().length) return;

        if (this.audioContext) {
            this.audioContext.close();
        }
        
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.microphoneSource = this.audioContext.createMediaStreamSource(stream);
        this.microphoneSource.connect(this.analyser);
    }

    getAudioLevel() {
        if (!this.analyser) return 0;
        
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        
        const average = sum / dataArray.length;
        // Normalize 0-255 to 0-100
        return Math.min(100, Math.round((average / 255) * 100 * 1.5)); // boost a bit
    }

    setAudioMuted(muted) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !muted;
            });
        }
    }

    setVideoEnabled(enabled) {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    async startScreenShare() {
        try {
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            return this.screenStream;
        } catch (err) {
            console.error('Error starting screen share:', err);
            return null;
        }
    }

    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
    }

    startRecording(stream) {
        if (!stream) return;
        
        this.recordedChunks = [];
        const options = { mimeType: 'video/webm; codecs=vp9' };
        
        try {
            this.mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
            console.warn('VP9 not supported, trying default webm');
            this.mediaRecorder = new MediaRecorder(stream);
        }

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            document.body.appendChild(a);
            a.style = 'display: none';
            a.href = url;
            a.download = `recording-${new Date().getTime()}.webm`;
            a.click();
            window.URL.revokeObjectURL(url);
        };

        this.mediaRecorder.start();
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }
}
