'use client';

import { useEffect, useRef } from 'react';
import { useCallStore } from '@/store/callStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { WebSocketClient } from '@/lib/websocket';

import IncomingCall from './IncomingCall';
import OutgoingCall from './OutgoingCall';
import AudioCall from './AudioCall';
import VideoCall from './VideoCall';

interface CallManagerProps {
  wsClient: WebSocketClient | null;
}

export default function CallManager({ wsClient }: CallManagerProps) {
  const { currentCall, setCurrentCall, setCallStatus, clearCurrentCall } = useCallStore();
  
  const {
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
  } = useWebRTC({ wsClient });

  const hasInitializedRef = useRef(false);
  const isCallerRef = useRef(false);

  // Send call request when outgoing call is initiated (but DON'T initialize peer yet)
  useEffect(() => {
    if (currentCall?.status === 'outgoing' && wsClient && !hasInitializedRef.current) {
      console.log('📞 Sending call request...');
      wsClient.sendCallRequest(currentCall.calleeId, currentCall.type);
      isCallerRef.current = true;
      hasInitializedRef.current = true; // Mark as sent
    }
  }, [currentCall, wsClient]);

  // Listen to WebSocket call events
  useEffect(() => {
    if (!wsClient) return;

    // Incoming call request
    const handleCallRequest = (payload: any) => {
      console.log('📞 Incoming call request:', payload);
      isCallerRef.current = false;
      setCurrentCall({
        callId: payload.call_id,
        callerId: payload.from,
        calleeId: payload.to,
        type: payload.call_type,
        status: 'ringing',
        startedAt: new Date(),
      });
    };

    // Call accepted - CALLER receives this
    const handleCallAccept = async (payload: any) => {
      console.log('✅ Call accepted:', payload);
      
      if (isCallerRef.current && currentCall) {
        try {
          // NOW initialize peer connection for caller
          console.log('🔧 Initializing peer connection for caller...');
          await initializePeer(currentCall.type);
          
          // Create and send offer
          console.log('📤 Creating and sending offer...');
          await createOffer();
          
          // Update status
          setCallStatus('active');
        } catch (error) {
          console.error('Failed to initialize peer or create offer:', error);
          handleCancelCall();
        }
      }
    };

    // Call rejected
    const handleCallReject = (payload: any) => {
      console.log('❌ Call rejected:', payload);
      cleanup();
      clearCurrentCall();
      hasInitializedRef.current = false;
      isCallerRef.current = false;
    };

    // Call ended
    const handleCallEnd = (payload: any) => {
      console.log('📴 Call ended:', payload);
      cleanup();
      clearCurrentCall();
      hasInitializedRef.current = false;
      isCallerRef.current = false;
    };

    // SDP Offer received - CALLEE receives this
    const handleOfferReceived = async (payload: any) => {
      console.log('📥 Offer received:', payload);
      
      if (!isCallerRef.current) {
        try {
          // Handle the offer
          await handleOffer(payload.sdp);
          console.log('✅ Offer processed successfully');
        } catch (error) {
          console.error('Failed to handle offer:', error);
        }
      }
    };

    // SDP Answer received - CALLER receives this
    const handleAnswerReceived = async (payload: any) => {
      console.log('📥 Answer received:', payload);
      
      if (isCallerRef.current) {
        try {
          await handleAnswer(payload.sdp);
          console.log('✅ Answer processed successfully');
        } catch (error) {
          console.error('Failed to handle answer:', error);
        }
      }
    };

    // ICE Candidate received
    const handleIceCandidateReceived = async (payload: any) => {
      console.log('📥 ICE candidate received:', payload);
      try {
        await handleIceCandidate(payload.candidate);
      } catch (error) {
        console.error('Failed to add ICE candidate:', error);
      }
    };

    // Register event listeners
    wsClient.on('call-request', handleCallRequest);
    wsClient.on('call-accept', handleCallAccept);
    wsClient.on('call-reject', handleCallReject);
    wsClient.on('call-end', handleCallEnd);
    wsClient.on('offer', handleOfferReceived);
    wsClient.on('answer', handleAnswerReceived);
    wsClient.on('ice-candidate', handleIceCandidateReceived);

    // Cleanup
    return () => {
      wsClient.off('call-request', handleCallRequest);
      wsClient.off('call-accept', handleCallAccept);
      wsClient.off('call-reject', handleCallReject);
      wsClient.off('call-end', handleCallEnd);
      wsClient.off('offer', handleOfferReceived);
      wsClient.off('answer', handleAnswerReceived);
      wsClient.off('ice-candidate', handleIceCandidateReceived);
    };
  }, [wsClient, currentCall, setCurrentCall, setCallStatus, clearCurrentCall, initializePeer, createOffer, handleOffer, handleAnswer, handleIceCandidate, cleanup]);

  // Handle call acceptance - CALLEE accepts
  const handleAcceptCall = async () => {
    if (!currentCall || !wsClient) return;

    try {
      console.log('✅ Accepting call...');
      
      // Initialize peer connection for callee
      console.log('🔧 Initializing peer connection for callee...');
      await initializePeer(currentCall.type);
      
      // Send accept message
      console.log('📤 Sending call accept...');
      wsClient.sendCallAccept(currentCall.callId, currentCall.callerId);
      
      // Update status
      setCallStatus('active');
      
      console.log('✅ Call accepted successfully, waiting for offer...');
    } catch (error) {
      console.error('Failed to accept call:', error);
      alert(`Failed to access ${currentCall.type === 'video' ? 'camera/microphone' : 'microphone'}. Please grant permissions and try again.`);
      handleRejectCall();
    }
  };

  // Handle call rejection
  const handleRejectCall = () => {
    if (!currentCall || !wsClient) return;

    wsClient.sendCallReject(currentCall.callId, currentCall.callerId);
    cleanup();
    clearCurrentCall();
    hasInitializedRef.current = false;
    isCallerRef.current = false;
  };

  // Handle call cancellation (outgoing)
  const handleCancelCall = () => {
    if (!currentCall || !wsClient) return;

    wsClient.sendCallEnd(currentCall.callId, currentCall.calleeId);
    cleanup();
    clearCurrentCall();
    hasInitializedRef.current = false;
    isCallerRef.current = false;
  };

  // Handle call end
  const handleEndCall = () => {
    if (!currentCall || !wsClient) return;

    // Determine the other user ID
    const currentUserId = isCallerRef.current ? currentCall.callerId : currentCall.calleeId;
    const otherUserId = isCallerRef.current ? currentCall.calleeId : currentCall.callerId;

    wsClient.sendCallEnd(currentCall.callId, otherUserId);
    cleanup();
    clearCurrentCall();
    hasInitializedRef.current = false;
    isCallerRef.current = false;
  };

  // Render appropriate UI based on call status
  if (!currentCall) return null;

  // Get user name - show the OTHER person's name
  const getUserName = () => {
    // If we're the caller, show callee's name, otherwise show caller's name
    const otherUserId = isCallerRef.current ? currentCall.calleeId : currentCall.callerId;
    return `User ${otherUserId}`;
  };

  switch (currentCall.status) {
    case 'ringing':
      return (
        <IncomingCall
          callerName={getUserName()}
          callType={currentCall.type}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      );

    case 'outgoing':
      return (
        <OutgoingCall
          calleeName={getUserName()}
          callType={currentCall.type}
          onCancel={handleCancelCall}
        />
      );

    case 'active':
      if (currentCall.type === 'video') {
        return (
          <VideoCall
            userName={getUserName()}
            localStream={localStream}
            remoteStream={remoteStream}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onEndCall={handleEndCall}
          />
        );
      } else {
        return (
          <AudioCall
            userName={getUserName()}
            localStream={localStream}
            remoteStream={remoteStream}
            isAudioEnabled={isAudioEnabled}
            onToggleAudio={toggleAudio}
            onEndCall={handleEndCall}
          />
        );
      }

    default:
      return null;
  }
}
