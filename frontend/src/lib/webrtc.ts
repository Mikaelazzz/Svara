// WebRTC Configuration
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // For production, add TURN servers:
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'user',
  //   credential: 'pass'
  // }
];

// Media Constraints
export const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

export const VIDEO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: "user",
  },
};

// WebRTC Peer Connection Helper
export class WebRTCPeer {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  constructor(
    private onIceCandidate: (candidate: RTCIceCandidate) => void,
    private onRemoteStream: (stream: MediaStream) => void
  ) {}

  async initialize(constraints: MediaStreamConstraints): Promise<MediaStream> {
    // Get local media stream
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local stream tracks to peer connection
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        this.onRemoteStream(this.remoteStream);
      }
      this.remoteStream.addTrack(event.track);
    };

    return this.localStream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  async setRemoteDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(description)
    );
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  cleanup(): void {
    // Stop all local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Stop all remote tracks
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }
}
