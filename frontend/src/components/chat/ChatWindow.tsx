'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Phone, Video } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import api from '@/lib/api';

import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

interface ChatWindowProps {
  userId: number;
  onClose: () => void;
}

export default function ChatWindow({ userId, onClose }: ChatWindowProps) {
  const currentUser = useAuthStore((state) => state.user);
  const messages = useChatStore((state) => state.messages.get(userId) || []);
  const setMessages = useChatStore((state) => state.setMessages);
  
  const { sendMessage, sendTyping, markAsRead, typingUsers } = useWebSocket(
    useAuthStore((state) => state.accessToken)
  );

  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef(false);

  // Load messages only once
  useEffect(() => {
    if (loadedRef.current) return;
    
    const loadMessages = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/chat/messages?user_id=${userId}`);
        const msgs = response.data.data || [];
        // Backend returns ASC order (oldest first), no need to reverse
        setMessages(userId, msgs);
        
        // Mark messages as read
        msgs.forEach((msg: any) => {
          if (msg.sender_id === userId && !msg.read_at) {
            markAsRead(msg.id);
          }
        });
        
        loadedRef.current = true;
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [userId]);

  // Load other user info
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        setOtherUser({
          id: userId,
          name: `User ${userId}`,
          status: 'online',
        });
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    };

    loadUserInfo();
  }, [userId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset loaded ref when userId changes
  useEffect(() => {
    loadedRef.current = false;
  }, [userId]);

  // ESC key handler to close chat
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);

    // Send typing indicator
    sendTyping(userId, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(userId, false);
    }, 3000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    sendMessage(userId, inputValue.trim());
    setInputValue('');
    sendTyping(userId, false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium">
              {otherUser?.name.charAt(0).toUpperCase()}
            </div>
            {otherUser?.status === 'online' && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{otherUser?.name}</h3>
            <p className="text-xs text-gray-500">
              {otherUser?.status === 'online' ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Call Buttons */}
        <div className="flex gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition" title="Voice Call">
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg transition" title="Video Call">
            <Video className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === currentUser?.id}
              />
            ))}
            {typingUsers.has(userId) && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-full outline-none focus:ring-2 focus:ring-primary-500 transition"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
