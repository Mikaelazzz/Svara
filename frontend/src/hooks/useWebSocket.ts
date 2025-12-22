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
  const currentUserId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return;
    }

    // Initialize WebSocket client
    const client = new WebSocketClient(token);
    wsClient.current = client;

    // Connect
    client.connect()
      .then(() => setIsConnected(true))
      .catch((error) => {
        console.error('Failed to connect WebSocket:', error);
        setIsConnected(false);
      });

    // Handle incoming messages
    client.on('message', (payload: Message) => {
      console.log('Received message:', payload);
      
      // Add message to store
      const otherUserId = payload.sender_id === currentUserId ? payload.receiver_id : payload.sender_id;
      addMessage(payload);
      
      // Update conversation list with user name from message (temporary)
      updateConversationWithMessage(otherUserId, `User ${otherUserId}`, payload);
      
      // Send delivery receipt
      client.sendReceipt(payload.id, 'delivered');
    });

    // Handle message sent confirmation
    client.on('message_sent', (payload: Message) => {
      console.log('Message sent confirmation:', payload);
      addMessage(payload);
      
      // Update conversation list
      updateConversationWithMessage(payload.receiver_id, `User ${payload.receiver_id}`, payload);
    });

    // Handle typing indicators
    client.on('typing', (payload: { user_id: number; is_typing: boolean }) => {
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
      updateMessage(payload.message_id, {
        ...(payload.status === 'delivered' && { delivered_at: new Date().toISOString() }),
        ...(payload.status === 'read' && { read_at: new Date().toISOString() }),
      });
    });

    // Handle user status
    client.on('user_status', (payload: { user_id: number; status: string }) => {
      console.log('User status:', payload);
    });

    // Cleanup
    return () => {
      client.disconnect();
      setIsConnected(false);
    };
  }, [token, addMessage, updateMessage, updateConversationWithMessage, currentUserId]);

  const sendMessage = (receiverId: number, content: string) => {
    wsClient.current?.sendMessage(receiverId, content);
  };

  const sendTyping = (receiverId: number, isTyping: boolean) => {
    wsClient.current?.sendTyping(receiverId, isTyping);
  };

  const markAsRead = (messageId: number) => {
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
