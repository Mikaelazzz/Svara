import { useEffect, useRef, useState } from 'react';
import { WebSocketClient } from '@/lib/websocket';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import type { Message } from '@/types/chat';

export function useWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const wsClient = useRef<WebSocketClient | null>(null);
  
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const updateConversationWithMessage = useChatStore((state) => state.updateConversationWithMessage);
  const updateUserStatus = useChatStore((state) => state.updateUserStatus);
  const currentUserId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!token) {
      console.log('No token, skipping WebSocket connection');
      setIsConnected(false);
      return;
    }

    console.log('Initializing WebSocket with token');
    const client = new WebSocketClient(token);
    wsClient.current = client;

    client.connect()
      .then(() => {
        console.log('WebSocket connected, setting up event listeners');
        setIsConnected(true);
      })
      .catch((error) => {
        // console.error('Failed to connect WebSocket:', error);
        setIsConnected(false);
      });

    // Handle incoming messages
    client.on('message', (payload: Message) => {
      console.log('📨 Received message event:', payload);
      const otherUserId = payload.sender_id === currentUserId ? payload.receiver_id : payload.sender_id;
      
      console.log('Adding message to store:', payload);
      addMessage(payload);
      
      console.log('Updating conversation with message');
      updateConversationWithMessage(otherUserId, `User ${otherUserId}`, payload);
      
      console.log('Sending delivery receipt');
      client.sendReceipt(payload.id, 'delivered');
    });

    // Handle message sent confirmation
    client.on('message_sent', (payload: Message) => {
      console.log('✅ Message sent confirmation:', payload);
      addMessage(payload);
      updateConversationWithMessage(payload.receiver_id, `User ${payload.receiver_id}`, payload);
    });

    // Handle typing indicators
    client.on('typing', (payload: { user_id: number; is_typing: boolean }) => {
      console.log('⌨️ Typing indicator:', payload);
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (payload.is_typing) {
          newSet.add(payload.user_id);
        } else {
          newSet.delete(payload.user_id);
        }
        return newSet;
      });
    });

    // Handle message receipts
    client.on('receipt', (payload: { message_id: number; status: string }) => {
      console.log('📬 Receipt:', payload);
      updateMessage(payload.message_id, {
        ...(payload.status === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(payload.status === 'read' && { read_at: new Date().toISOString() }),
      });
    });

    // Handle user status updates (REAL-TIME)
    client.on('user_status', (payload: { user_id: number; status: string }) => {
      console.log('👤 User status update:', payload);
      updateUserStatus(payload.user_id, payload.status as 'online' | 'offline');
    });

    console.log('All WebSocket event listeners registered');

    // Cleanup
    return () => {
      console.log('Cleaning up WebSocket connection');
      client.disconnect();
      setIsConnected(false);
    };
  }, [token, addMessage, updateMessage, updateConversationWithMessage, updateUserStatus, currentUserId]);

  const sendMessage = (receiverId: number, content: string) => {
    console.log('Sending message via WebSocket:', { receiverId, content });
    wsClient.current?.sendMessage(receiverId, content);
  };

  const sendTyping = (receiverId: number, isTyping: boolean) => {
    wsClient.current?.sendTyping(receiverId, isTyping);
  };

  const markAsRead = (messageId: number) => {
    console.log('Marking message as read:', messageId);
    wsClient.current?.sendReceipt(messageId, 'read');
  };

  return {
    isConnected,
    typingUsers,
    sendMessage,
    sendTyping,
    markAsRead,
  };
}
