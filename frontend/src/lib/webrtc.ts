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
    console.log('🔧 WebRTCPeer: Initializing with constraints:', constraints);
    
    // Get local media stream
    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('✅ WebRTCPeer: Got local stream with tracks:', this.localStream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, id: t.id })));

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    console.log('✅ WebRTCPeer: Peer connection created');

    // Add local stream tracks to peer connection
    this.localStream.getTracks().forEach((track) => {
      console.log('📤 WebRTCPeer: Adding track to peer connection:', track.kind);
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 WebRTCPeer: ICE candidate generated:', event.candidate.candidate?.substring(0, 50));
        this.onIceCandidate(event.candidate);
      } else {
        console.log('🧊 WebRTCPeer: ICE gathering complete');
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 WebRTCPeer: ICE connection state:', this.peerConnection?.iceConnectionState);
      if (this.peerConnection?.iceConnectionState === 'connected') {
        console.log('✅ WebRTCPeer: ICE Connected! Audio should work now.');
      } else if (this.peerConnection?.iceConnectionState === 'failed') {
        console.error('❌ WebRTCPeer: ICE Connection failed!');
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      console.log('🔗 WebRTCPeer: Connection state:', this.peerConnection?.connectionState);
    };

    // Handle signaling state changes
    this.peerConnection.onsignalingstatechange = () => {
      console.log('📡 WebRTCPeer: Signaling state:', this.peerConnection?.signalingState);
    };

    // Handle ICE gathering state changes
    this.peerConnection.onicegatheringstatechange = () => {
      console.log('🧊 WebRTCPeer: ICE gathering state:', this.peerConnection?.iceGatheringState);
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log('📥 WebRTCPeer: Remote track received:', event.track.kind, 'enabled:', event.track.enabled);
      if (!this.remoteStream) {
        this.remoteStream = new MediaStream();
        console.log('✅ WebRTCPeer: Created new remote stream');
      }
      this.remoteStream.addTrack(event.track);
      console.log('✅ WebRTCPeer: Remote stream now has tracks:', this.remoteStream.getTracks().length);
      this.onRemoteStream(this.remoteStream);
    };

    return this.localStream;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");

    console.log('📤 WebRTCPeer: Creating offer...');
    const offer = await this.peerConnection.createOffer();
    console.log('📤 WebRTCPeer: Setting local description (offer)');
    await this.peerConnection.setLocalDescription(offer);
    console.log('✅ WebRTCPeer: Offer created, SDP type:', offer.type);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");

    console.log('📥 WebRTCPeer: Creating answer...');
    const answer = await this.peerConnection.createAnswer();
    console.log('📥 WebRTCPeer: Setting local description (answer)');
    await this.peerConnection.setLocalDescription(answer);
    console.log('✅ WebRTCPeer: Answer created, SDP type:', answer.type);
    return answer;
  }

  async setRemoteDescription(
    description: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");
    console.log('📡 WebRTCPeer: Setting remote description, type:', description.type);
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(description)
    );
    console.log('✅ WebRTCPeer: Remote description set successfully');
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection)
      throw new Error("Peer connection not initialized");
    console.log('🧊 WebRTCPeer: Adding ICE candidate:', candidate.candidate?.substring(0, 50));
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log('✅ WebRTCPeer: ICE candidate added successfully');
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
