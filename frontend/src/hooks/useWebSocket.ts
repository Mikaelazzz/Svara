import { useEffect, useState, useRef } from 'react';
import { WebSocketClient } from '@/lib/websocket';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useCallStore } from '@/store/callStore';

export function useWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);
  const isCallerRef = useRef(false);

  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const updateConversationWithMessage = useChatStore((state) => state.updateConversationWithMessage);
  const updateConversationLastMessage = useChatStore((state) => state.updateConversationLastMessage);
  const updateUserStatus = useChatStore((state) => state.updateUserStatus);
  const currentUserId = useAuthStore((state) => state.user?.id);
  
  // Call store actions
  const setCurrentCall = useCallStore((state) => state.setCurrentCall);
  const setCallStatus = useCallStore((state) => state.setCallStatus);
  const clearCurrentCall = useCallStore((state) => state.clearCurrentCall);

  useEffect(() => {
    if (!token) {
      console.log('No token provided, skipping WebSocket connection');
      return;
    }

    console.log('🔌 Initializing WebSocket connection...');
    const client = new WebSocketClient(token);
    clientRef.current = client;

    // CRITICAL: Register ALL call event listeners IMMEDIATELY when client is created
    console.log('📞 Registering ALL call event listeners IMMEDIATELY...');
    
    // Incoming call request
    client.on('call-request', (payload: any) => {
      console.log('📞 INCOMING CALL REQUEST:', payload);
      isCallerRef.current = false;
      const newCall = {
        callId: payload.call_id,
        callerId: payload.from,
        calleeId: payload.to,
        type: payload.call_type,
        status: 'ringing' as const,
        startedAt: new Date(),
      };
      console.log('📞 Setting call state (CALLEE):', newCall);
      setCurrentCall(newCall);
    });
    
    // Call accepted
    client.on('call-accept', (payload: any) => {
      console.log('✅ CALL ACCEPTED:', payload);
      if (isCallerRef.current) {
        console.log('✅ We are CALLER, updating status to active');
        setCallStatus('active');
      }
    });
    
    // Call rejected
    client.on('call-reject', (payload: any) => {
      console.log('❌ CALL REJECTED:', payload);
      clearCurrentCall();
      isCallerRef.current = false;
    });
    
    // Call ended
    client.on('call-end', (payload: any) => {
      console.log('📴 CALL ENDED:', payload);
      clearCurrentCall();
      isCallerRef.current = false;
    });
    
    console.log('✅ All call event listeners registered');

    // Chat event listeners
    client.on('message', (payload: any) => {
      console.log('📨 Received message event:', payload);
      const otherUserId = payload.sender_id === currentUserId ? payload.receiver_id : payload.sender_id;
      
      addMessage(payload);
      
      if (payload.sender_id !== currentUserId) {
        updateConversationWithMessage(otherUserId, `User ${otherUserId}`, payload);
      } else {
        updateConversationLastMessage(otherUserId, payload);
      }
      
      client.sendReceipt(payload.id, 'delivered');
    });

    client.on('message_sent', (payload: any) => {
      console.log('✅ Message sent confirmation:', payload);
      addMessage(payload);
      updateConversationLastMessage(payload.receiver_id, payload);
    });

    client.on('typing', (payload: { user_id: number; is_typing: boolean }) => {
      console.log('⌨️ Typing indicator:', payload);
    });

    client.on('receipt', (payload: { message_id: number; status: string }) => {
      console.log('📬 Receipt:', payload);
      updateMessage(payload.message_id, {
        ...(payload.status === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(payload.status === 'read' && { read_at: new Date().toISOString() }),
      });
    });

    client.on('user_status', (payload: { user_id: number; status: 'online' | 'offline' }) => {
      console.log('👤 User status update:', payload);
      updateUserStatus(payload.user_id, payload.status);
    });

    // Connect
    client
      .connect()
      .then(() => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setWsClient(client);
      })
      .catch((error) => {
        console.error('❌ WebSocket connection failed:', error);
        setIsConnected(false);
      });

    return () => {
      console.log('🔌 Cleaning up WebSocket connection');
      client.disconnect();
      setIsConnected(false);
      clientRef.current = null;
    };
  }, [token, addMessage, updateMessage, updateConversationWithMessage, updateConversationLastMessage, updateUserStatus, currentUserId, setCurrentCall, setCallStatus, clearCurrentCall]);

  // Expose isCallerRef setter for CallManager
  const setIsCaller = (value: boolean) => {
    isCallerRef.current = value;
  };

  return { isConnected, wsClient, setIsCaller };
}
