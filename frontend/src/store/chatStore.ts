import { create } from 'zustand';
import type { Message, Conversation } from '@/types/chat';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: Map<number, Message[]>; // userId -> messages
  
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (userId: number) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: number, updates: Partial<Message>) => void;
  setMessages: (userId: number, messages: Message[]) => void;
  markAsRead: (userId: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: new Map(),

  setConversations: (conversations) => {
    set({ conversations });
  },

  setActiveConversation: (userId) => {
    set({ activeConversationId: userId });
  },

  addMessage: (message) => {
    set((state) => {
      const userId = message.sender_id === state.activeConversationId 
        ? message.sender_id 
        : message.receiver_id;
      
      const userMessages = state.messages.get(userId) || [];
      const newMessages = new Map(state.messages);
      newMessages.set(userId, [...userMessages, message]);

      return { messages: newMessages };
    });
  },

  updateMessage: (messageId, updates) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      
      for (const [userId, messages] of newMessages.entries()) {
        const updatedMessages = messages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
        newMessages.set(userId, updatedMessages);
      }

      return { messages: newMessages };
    });
  },

  setMessages: (userId, messages) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(userId, messages);
      return { messages: newMessages };
    });
  },

  markAsRead: (userId) => {
    set((state) => {
      const conversations = state.conversations.map(conv =>
        conv.user.id === userId ? { ...conv, unread_count: 0 } : conv
      );
      return { conversations };
    });
  },
}));
