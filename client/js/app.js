const roomId = document.querySelector('#roomId');

document.querySelector('#createMeeting').addEventListener('click', () => {
    roomId.value = crypto.randomUUID().slice(0, 8);
});

document.querySelector('#joinMeeting').addEventListener('click', () => {
    if (!roomId.value.trim()) return;
    console.log('Join room:', roomId.value.trim());
});
