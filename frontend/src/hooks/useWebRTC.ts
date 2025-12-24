import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCPeer, AUDIO_CONSTRAINTS, VIDEO_CONSTRAINTS } from '@/lib/webrtc';
import { useCallStore, CallType } from '@/store/callStore';
import { useAuthStore } from '@/store/authStore';

interface SignalingMessage {
  type: string;
  call_id?: string;
  to?: number;
  from?: number;
  sdp?: string;
  candidate?: {
    candidate: string;
    sdpMid: string;
    sdpMLineIndex: number;
  };
  call_type?: string;
}

interface UseWebRTCProps {
  wsClient?: any; // WebSocketClient instance
}

export function useWebRTC({ wsClient }: UseWebRTCProps = {}) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  
  const peerRef = useRef<WebRTCPeer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const { currentCall } = useCallStore();

  // Send signaling message via WebSocket
  const sendSignalingMessage = useCallback((message: SignalingMessage) => {
    if (!wsClient || !wsClient.isConnected()) {
      console.error('WebSocket is not connected');
      return;
    }

    // Send as raw WebSocket message with type and payload structure
    const wsMessage = {
      type: message.type,
      payload: message,
    };

    console.log('📤 Sending signaling message:', wsMessage);
    wsClient.ws?.send(JSON.stringify(wsMessage));
  }, [wsClient]);

  // Initialize WebRTC peer connection
  const initializePeer = useCallback(async (callType: CallType) => {
    try {
      const constraints = callType === 'video' ? VIDEO_CONSTRAINTS : AUDIO_CONSTRAINTS;
      
      const peer = new WebRTCPeer(
        // On ICE candidate
        (candidate) => {
          if (currentCall) {
            // Determine target user - send to the OTHER user
            // Use auth store to get the current user's ID, not call store
            const currentUserId = useAuthStore.getState().user?.id;
            const targetUserId = currentUserId === currentCall.callerId 
              ? currentCall.calleeId 
              : currentCall.callerId;
            
            sendSignalingMessage({
              type: 'ice-candidate',
              call_id: currentCall.callId,
              to: targetUserId,
              candidate: {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid || '',
                sdpMLineIndex: candidate.sdpMLineIndex || 0,
              },
            });
          }
        },
        // On remote stream
        (stream) => {
          setRemoteStream(stream);
        }
      );

      const stream = await peer.initialize(constraints);
      setLocalStream(stream);
      peerRef.current = peer;

      return peer;
    } catch (error) {
      console.error('Failed to initialize WebRTC:', error);
      throw error;
    }
  }, [currentCall, sendSignalingMessage]);

  // Create and send offer
  const createOffer = useCallback(async () => {
    if (!peerRef.current || !currentCall) return;

    try {
      const offer = await peerRef.current.createOffer();
      
      sendSignalingMessage({
        type: 'offer',
        call_id: currentCall.callId,
        to: currentCall.calleeId,
        sdp: offer.sdp || '',
      });
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  }, [currentCall, sendSignalingMessage]);

  // Create and send answer
  const createAnswer = useCallback(async () => {
    if (!peerRef.current || !currentCall) return;

    try {
      const answer = await peerRef.current.createAnswer();
      
      sendSignalingMessage({
        type: 'answer',
        call_id: currentCall.callId,
        to: currentCall.callerId,
        sdp: answer.sdp || '',
      });
    } catch (error) {
      console.error('Failed to create answer:', error);
    }
  }, [currentCall, sendSignalingMessage]);

  // Handle received offer
  const handleOffer = useCallback(async (sdp: string) => {
    if (!peerRef.current) return;

    try {
      await peerRef.current.setRemoteDescription({ type: 'offer', sdp });
      await createAnswer();
    } catch (error) {
      console.error('Failed to handle offer:', error);
    }
  }, [createAnswer]);

  // Handle received answer
  const handleAnswer = useCallback(async (sdp: string) => {
    if (!peerRef.current) return;

    try {
      await peerRef.current.setRemoteDescription({ type: 'answer', sdp });
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }, []);

  // Handle received ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!peerRef.current) return;

    try {
      await peerRef.current.addIceCandidate(candidate);
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    if (peerRef.current) {
      const newState = !isAudioEnabled;
      peerRef.current.toggleAudio(newState);
      setIsAudioEnabled(newState);
    }
  }, [isAudioEnabled]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (peerRef.current) {
      const newState = !isVideoEnabled;
      peerRef.current.toggleVideo(newState);
      setIsVideoEnabled(newState);
    }
  }, [isVideoEnabled]);

  // Cleanup
  const cleanup = useCallback(() => {
    // Cleanup audio analyzer
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    
    if (peerRef.current) {
      peerRef.current.cleanup();
      peerRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    setIsSpeaking(false);
    setIsRemoteMuted(false);
  }, []);

  // Audio level detection for speaking indicator
  useEffect(() => {
    if (!remoteStream) {
      setIsSpeaking(false);
      return;
    }

    const audioTracks = remoteStream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.log('🔊 No audio tracks in remote stream');
      return;
    }

    console.log('🔊 Setting up audio level detection...');

    try {
      // Create audio context and analyzer
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(remoteStream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Check audio levels periodically
      const checkAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        // Threshold for "speaking" (adjust as needed)
        const isSpeakingNow = average > 15;
        setIsSpeaking(isSpeakingNow);

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
      console.log('✅ Audio level detection started');

    } catch (error) {
      console.error('❌ Failed to setup audio level detection:', error);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [remoteStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    isSpeaking,
    isRemoteMuted,
    setIsRemoteMuted,
    initializePeer,
    createOffer,
    createAnswer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleAudio,
    toggleVideo,
    cleanup,
  };
}
