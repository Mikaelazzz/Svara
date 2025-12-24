import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCPeer, AUDIO_CONSTRAINTS, VIDEO_CONSTRAINTS } from '@/lib/webrtc';
import { useCallStore, CallType } from '@/store/callStore';

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
  
  const peerRef = useRef<WebRTCPeer | null>(null);
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
            const currentUserId = useCallStore.getState().currentCall?.callerId;
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
    if (peerRef.current) {
      peerRef.current.cleanup();
      peerRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
  }, []);

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
