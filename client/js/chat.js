export class ChatManager {
    constructor() {
        this.container = document.getElementById('chat-messages');
    }

    appendMessage({ participantId, displayName, text, timestamp }) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';
        
        const meta = document.createElement('div');
        meta.className = 'meta';
        const date = timestamp ? new Date(timestamp) : new Date();
        meta.textContent = `${displayName || participantId} • ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        
        const content = document.createElement('div');
        content.className = 'text';
        content.textContent = text;
        
        msgDiv.appendChild(meta);
        msgDiv.appendChild(content);
        
        this.container.appendChild(msgDiv);
        this.container.scrollTop = this.container.scrollHeight;
    }

    clear() {
        this.container.innerHTML = '';
    }
}
