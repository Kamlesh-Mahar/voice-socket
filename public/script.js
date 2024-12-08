const socket = io()
let localStream
let peerConnection
const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
const toggleButton = document.getElementById("voice-call-toggle")
const optionsContainer = document.getElementById("voice-call-options")
const joinCallButton = document.getElementById("join-call")
const muteButton = document.getElementById("mute")
let isMuted = false
let isInCall = false

toggleButton.addEventListener("click", (e) => {
    e.stopPropagation() 
    const isVisible = optionsContainer.style.display === "block"
    optionsContainer.style.display = isVisible ? "none" : "block"
})

document.addEventListener("click", (e) => {
    if (!optionsContainer.contains(e.target) && e.target !== toggleButton) {
        optionsContainer.style.display = "none"
    }
})

joinCallButton.addEventListener("click", async () => {
    if (!isInCall) {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 }
        })
        muteButton.disabled = false
        joinCallButton.textContent = "Leave Call"
        joinCallButton.innerHTML = '<span class="icon">📞</span> Leave Call'
        isInCall = true
        peerConnection = new RTCPeerConnection(config)
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
        peerConnection.onicecandidate = (e) => e.candidate && socket.emit("candidate", e.candidate)
        peerConnection.ontrack = (e) => {
            const remoteAudio = new Audio()
            remoteAudio.srcObject = e.streams[0]
            remoteAudio.play()
        }
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)
        socket.emit("offer", offer)
    } else {
        leaveCall()
    }
})

muteButton.addEventListener("click", () => {
    isMuted = !isMuted
    localStream.getAudioTracks()[0].enabled = !isMuted
    muteButton.textContent = isMuted ? "Unmute" : "Mute"
    muteButton.innerHTML = isMuted ? '<span class="icon">🔊</span> Unmute' : '<span class="icon">🔇</span> Mute'
})

const leaveCall = () => {
    localStream.getTracks().forEach((track) => track.stop())
    if (peerConnection) {
        peerConnection.close()
        peerConnection = null
    }
    joinCallButton.textContent = "Join Call"
    joinCallButton.innerHTML = '<span class="icon">🎙️</span> Join Call'
    muteButton.disabled = true
    isInCall = false
    optionsContainer.style.display = "none"
}

socket.on("offer", async (offer) => {
    if (!peerConnection) {
        peerConnection = new RTCPeerConnection(config)
        peerConnection.onicecandidate = (e) => e.candidate && socket.emit("candidate", e.candidate)
        peerConnection.ontrack = (e) => {
            const remoteAudio = new Audio()
            remoteAudio.srcObject = e.streams[0]
            remoteAudio.play()
        }
        localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream))
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await peerConnection.createAnswer()
    await peerConnection.setLocalDescription(answer)
    socket.emit("answer", answer)
})

socket.on("answer", (answer) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer))
})

socket.on("candidate", (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
})
