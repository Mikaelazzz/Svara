'use client';

import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/store/callStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useWebRTC } from '@/hooks/useWebRTC';
import { WebSocketClient } from '@/lib/websocket';

import IncomingCall from './IncomingCall';
import OutgoingCall from './OutgoingCall';
import AudioCall from './AudioCall';
import VideoCall from './VideoCall';

interface CallManagerProps {
  wsClient: WebSocketClient | null;
  setIsCaller: (value: boolean) => void;
}

export default function CallManager({ wsClient, setIsCaller }: CallManagerProps) {
  // IMPORTANT: Use separate selectors to ensure reactivity!
  const currentCall = useCallStore((state) => state.currentCall);
  const setCurrentCall = useCallStore((state) => state.setCurrentCall);
  const setCallStatus = useCallStore((state) => state.setCallStatus);
  const clearCurrentCall = useCallStore((state) => state.clearCurrentCall);
  
  console.log('🔧 CallManager render, currentCall:', currentCall);
  
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
  const peerInitializedRef = useRef(false);
  const [, forceUpdate] = useState({});

  // Debug: Log when component mounts/unmounts
  useEffect(() => {
    console.log('🔧 CallManager mounted, wsClient:', wsClient ? 'connected' : 'null');
    return () => {
      console.log('🔧 CallManager unmounting');
    };
  }, [wsClient]);

  // Debug: Track currentCall changes AND force re-render
  useEffect(() => {
    console.log('🔄 CallManager: currentCall changed:', currentCall);
    if (currentCall) {
      console.log('🔄 Call details:', {
        callId: currentCall.callId,
        status: currentCall.status,
        callerId: currentCall.callerId,
        calleeId: currentCall.calleeId,
        type: currentCall.type
      });
      console.log('🔄 Forcing component re-render...');
      forceUpdate({});
    }
  }, [currentCall]);

  // Send call request when outgoing call is initiated (but DON'T initialize peer yet)
  useEffect(() => {
    if (currentCall?.status === 'outgoing' && wsClient && !hasInitializedRef.current) {
      console.log('📞 Sending call request...', {
        calleeId: currentCall.calleeId,
        type: currentCall.type,
        wsConnected: wsClient.isConnected()
      });
      wsClient.sendCallRequest(currentCall.calleeId, currentCall.type);
      setIsCaller(true);
      hasInitializedRef.current = true; // Mark as sent
    }
  }, [currentCall, wsClient, setIsCaller]);

  // CRITICAL: Initialize WebRTC when call becomes active (for CALLER)
  useEffect(() => {
    const initWebRTCForCaller = async () => {
      if (!currentCall || !wsClient) return;
      
      // Check if we're the caller and status just became active
      const currentUserId = useAuthStore.getState().user?.id;
      const isCaller = currentUserId === currentCall.callerId;
      
      if (currentCall.status === 'active' && isCaller && !peerInitializedRef.current) {
        console.log('🔧 [useEffect] Status became active, initializing WebRTC for caller...');
        peerInitializedRef.current = true;
        
        try {
          await initializePeer(currentCall.type);
          console.log('📤 Creating and sending offer...');
          await createOffer();
          console.log('✅ WebRTC offer sent successfully!');
        } catch (error) {
          console.error('Failed to initialize WebRTC:', error);
        }
      }
    };
    
    initWebRTCForCaller();
  }, [currentCall?.status, currentCall?.callerId, currentCall?.type, wsClient, initializePeer, createOffer]);


  // Listen to WebSocket call events - MUST register IMMEDIATELY when wsClient is available
  useEffect(() => {
    if (!wsClient) {
      console.warn('⚠️ CallManager: wsClient is null, cannot register event listeners');
      return;
    }

    console.log('🎧 CallManager: Registering WebSocket event listeners...');


    // Call accepted - CALLER receives this
    const handleCallAccept = async (payload: any) => {
      console.log('✅ Call accepted in CallManager:', payload);
      
      // Determine if we are the caller by comparing IDs
      const currentUserId = useAuthStore.getState().user?.id;
      const isCaller = currentUserId === currentCall?.callerId;
      
      console.log('📞 handleCallAccept check:', { currentUserId, callerId: currentCall?.callerId, isCaller });
      
      if (isCaller && currentCall) {
        try {
          // NOW initialize peer connection for caller
          console.log('🔧 Initializing peer connection for caller...');
          await initializePeer(currentCall.type);
          
          // Create and send offer
          console.log('📤 Creating and sending offer...');
          await createOffer();
          
          // Update status
          setCallStatus('active');
          console.log('✅ WebRTC offer sent successfully!');
        } catch (error) {
          console.error('Failed to initialize peer or create offer:', error);
          handleCancelCall();
        }
      } else {
        console.log('ℹ️ Not the caller, skipping WebRTC initialization');
      }
    };

    // Call rejected
    const handleCallReject = (payload: any) => {
      console.log('❌ Call rejected:', payload);
      cleanup();
      clearCurrentCall();
      hasInitializedRef.current = false;
      isCallerRef.current = false;
      peerInitializedRef.current = false;
    };

    // Call ended
    const handleCallEnd = (payload: any) => {
      console.log('📴 Call ended:', payload);
      cleanup();
      clearCurrentCall();
      hasInitializedRef.current = false;
      isCallerRef.current = false;
      peerInitializedRef.current = false;
    };

    // SDP Offer received - CALLEE receives this
    const handleOfferReceived = async (payload: any) => {
      console.log('📥 Offer received in CallManager:', payload);
      
      // Determine if we are the callee
      const currentUserId = useAuthStore.getState().user?.id;
      const isCallee = currentUserId === currentCall?.calleeId;
      
      console.log('📞 handleOfferReceived check:', { currentUserId, calleeId: currentCall?.calleeId, isCallee });
      
      if (isCallee && currentCall) {
        try {
          // Handle the offer (peer should already be initialized in handleAcceptCall)
          await handleOffer(payload.sdp);
          console.log('✅ Offer processed and answer sent successfully');
        } catch (error) {
          console.error('Failed to handle offer:', error);
        }
      } else {
        console.log('ℹ️ Not the callee, skipping offer handling');
      }
    };

    // SDP Answer received - CALLER receives this
    const handleAnswerReceived = async (payload: any) => {
      console.log('📥 Answer received in CallManager:', payload);
      
      // Determine if we are the caller
      const currentUserId = useAuthStore.getState().user?.id;
      const isCaller = currentUserId === currentCall?.callerId;
      
      console.log('📞 handleAnswerReceived check:', { currentUserId, callerId: currentCall?.callerId, isCaller });
      
      if (isCaller) {
        try {
          await handleAnswer(payload.sdp);
          console.log('✅ Answer processed successfully');
        } catch (error) {
          console.error('Failed to handle answer:', error);
        }
      } else {
        console.log('ℹ️ Not the caller, skipping answer handling');
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

    // Register event listeners (call-request is handled in useWebSocket hook)
    console.log('✅ Registering event listeners (excluding call-request)...');
    
    wsClient.on('call-accept', handleCallAccept);
    console.log('✅ Registered: call-accept');
    wsClient.on('call-reject', handleCallReject);
    console.log('✅ Registered: call-reject');
    wsClient.on('call-end', handleCallEnd);
    console.log('✅ Registered: call-end');
    wsClient.on('offer', handleOfferReceived);
    console.log('✅ Registered: offer');
    wsClient.on('answer', handleAnswerReceived);
    console.log('✅ Registered: answer');
    wsClient.on('ice-candidate', handleIceCandidateReceived);
    console.log('✅ Registered: ice-candidate');

    console.log('✅ ALL event listeners registered successfully');

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up CallManager event listeners');
      wsClient.off('call-accept', handleCallAccept);
      wsClient.off('call-reject', handleCallReject);
      wsClient.off('call-end', handleCallEnd);
      wsClient.off('offer', handleOfferReceived);
      wsClient.off('answer', handleAnswerReceived);
      wsClient.off('ice-candidate', handleIceCandidateReceived);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsClient, setCurrentCall, setCallStatus, clearCurrentCall, initializePeer, createOffer, handleOffer, handleAnswer, handleIceCandidate, cleanup]);

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
    peerInitializedRef.current = false;
  };

  // Handle call cancellation (outgoing)
  const handleCancelCall = () => {
    if (!currentCall || !wsClient) return;

    wsClient.sendCallEnd(currentCall.callId, currentCall.calleeId);
    cleanup();
    clearCurrentCall();
    hasInitializedRef.current = false;
    isCallerRef.current = false;
    peerInitializedRef.current = false;
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
    peerInitializedRef.current = false;
  };

  // Render appropriate UI based on call status
  if (!currentCall) return null;

  console.log('🎨 CallManager rendering:', {
    status: currentCall.status,
    callerId: currentCall.callerId,
    calleeId: currentCall.calleeId,
    isCaller: isCallerRef.current,
    currentUserId: useAuthStore.getState().user?.id
  });

  // Get user name - show the OTHER person's name
  const getUserName = () => {
    if (!currentCall) return 'Unknown';
    
    // Determine which user we are
    const currentUserId = useAuthStore.getState().user?.id;
    
    // Get the OTHER user's ID
    const otherUserId = currentUserId === currentCall.callerId 
      ? currentCall.calleeId 
      : currentCall.callerId;
    
    // Try to get name from conversations
    const conversations = useChatStore.getState().conversations;
    const conversation = conversations.find((c: { user_id: number; name?: string }) => c.user_id === otherUserId);
    
    if (conversation?.name) {
      return conversation.name;
    }
    
    // Fallback to User ID
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
