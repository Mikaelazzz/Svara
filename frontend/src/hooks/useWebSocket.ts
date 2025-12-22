import { useEffect, useRef, useState } from 'react';
import { WebSocketClient } from '@/lib/websocket';
import type { Message } from '@/types/chat';

export function useWebSocket(token: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const wsClient = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!token) return;

    // Initialize WebSocket client
    const client = new WebSocketClient(token);
    wsClient.current = client;

    // Connect
    client.connect()
      .then(() => setIsConnected(true))
      .catch((error) => {
        console.error('Failed to connect:', error);
        setIsConnected(false);
      });

    // Handle incoming messages
    client.on('message', (payload: Message) => {
      setMessages(prev => [...prev, payload]);
      
      // Send delivery receipt
      client.sendReceipt(payload.id, 'delivered');
    });

    // Handle message sent confirmation
    client.on('message_sent', (payload: Message) => {
      setMessages(prev => [...prev, payload]);
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
      setMessages(prev => prev.map(msg => {
        if (msg.id === payload.message_id) {
          if (payload.status === 'delivered') {
            return { ...msg, delivered_at: new Date().toISOString() };
          } else if (payload.status === 'read') {
            return { ...msg, read_at: new Date().toISOString() };
          }
        }
        return msg;
      }));
    });

    // Handle user status
    client.on('user_status', (payload: { user_id: number; status: string }) => {
      console.log('User status:', payload);
      // Update user status in your state management
    });

    // Cleanup
    return () => {
      client.disconnect();
      setIsConnected(false);
    };
  }, [token]);

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
    messages,
    typingUsers,
    sendMessage,
    sendTyping,
    markAsRead,
  };
}
