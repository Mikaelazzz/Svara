import { create } from 'zustand';
import type { Message, Conversation } from '@/types/chat';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: Map<number, Message[]>;
  
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (userId: number | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: number, updates: Partial<Message>) => void;
  setMessages: (userId: number, messages: Message[]) => void;
  markAsRead: (userId: number) => void;
  updateConversationWithMessage: (userId: number, userName: string, message: Message) => void;
  updateConversationLastMessage: (userId: number, message: Message) => void;
  updateConversationMessageStatus: (messageId: number, status: 'delivered' | 'read') => void;
  updateUserStatus: (userId: number, status: 'online' | 'offline') => void;
  pinConversation: (userId: number) => void;
  deleteConversation: (userId: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: new Map(),

  setConversations: (conversations) => {
    // Restore pinned state from localStorage
    if (typeof window !== 'undefined') {
      const pinnedIdsStr = localStorage.getItem('pinned_conversations');
      if (pinnedIdsStr) {
        try {
          const pinnedIds: number[] = JSON.parse(pinnedIdsStr);
          conversations = conversations.map(conv => ({
            ...conv,
            is_pinned: pinnedIds.includes(conv.user_id)
          }));
          
          // Sort: pinned first
          const pinnedConvs = conversations.filter(c => c.is_pinned);
          const unpinnedConvs = conversations.filter(c => !c.is_pinned);
          conversations = [...pinnedConvs, ...unpinnedConvs];
        } catch (error) {
          console.error('Failed to restore pinned conversations:', error);
        }
      }
    }
    
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
      let updatedConversations = state.conversations;
      
      for (const [userId, messages] of newMessages.entries()) {
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          const updatedMessages = messages.map(msg =>
            msg.id === messageId ? { ...msg, ...updates } : msg
          );
          newMessages.set(userId, updatedMessages);
          
          // If this is the last message, also update the conversation's last_message
          if (messageIndex === messages.length - 1) {
            updatedConversations = state.conversations.map(conv =>
              conv.user_id === userId && conv.last_message
                ? { ...conv, last_message: { ...conv.last_message, ...updates } }
                : conv
            );
          }
          break;
        }
      }

      return { messages: newMessages, conversations: updatedConversations };
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
        conv.user_id === userId ? { ...conv, unread_count: 0 } : conv
      );
      return { conversations };
    });
  },

  updateConversationWithMessage: (userId, userName, message) => {
    set((state) => {
      const existingConv = state.conversations.find(c => c.user_id === userId);
      
      if (existingConv) {
        // Update existing conversation
        const conversations = state.conversations.map(conv =>
          conv.user_id === userId
            ? { 
                ...conv, 
                last_message: message,
                unread_count: message.sender_id === userId ? conv.unread_count + 1 : conv.unread_count 
              }
            : conv
        );
        // Move updated conversation to top (unless pinned)
        const updatedConv = conversations.find(c => c.user_id === userId);
        const pinnedConvs = conversations.filter(c => c.is_pinned && c.user_id !== userId);
        const otherConvs = conversations.filter(c => !c.is_pinned && c.user_id !== userId);
        
        if (updatedConv) {
          if (updatedConv.is_pinned) {
            return { conversations: [...pinnedConvs, updatedConv, ...otherConvs] };
          } else {
            return { conversations: [...pinnedConvs, updatedConv, ...otherConvs] };
          }
        }
        return { conversations };
      } else {
        // Add new conversation
        const newConv: Conversation = {
          user_id: userId,
          name: userName,
          status: 'online',
          last_message: message,
          unread_count: message.sender_id === userId ? 1 : 0,
          is_pinned: false,
        };
        const pinnedConvs = state.conversations.filter(c => c.is_pinned);
        const otherConvs = state.conversations.filter(c => !c.is_pinned);
        return { conversations: [...pinnedConvs, newConv, ...otherConvs] };
      }
    });
  },

  // Update only last message without changing unread count (for sent messages)
  updateConversationLastMessage: (userId, message) => {
    set((state) => {
      // Update the conversation's last message
      const updatedConversations = state.conversations.map(conv =>
        conv.user_id === userId
          ? { ...conv, last_message: message }
          : conv
      );
      
      // Find the updated conversation
      const targetConv = updatedConversations.find(c => c.user_id === userId);
      
      if (!targetConv) {
        return { conversations: updatedConversations };
      }
      
      // Separate pinned and unpinned conversations
      const pinnedConvs = updatedConversations.filter(c => c.is_pinned && c.user_id !== userId);
      const otherConvs = updatedConversations.filter(c => !c.is_pinned && c.user_id !== userId);
      
      // Move to top based on pinned status
      if (targetConv.is_pinned) {
        // If pinned, put at top of pinned section
        return { conversations: [targetConv, ...pinnedConvs, ...otherConvs] };
      } else {
        // If not pinned, put at top of unpinned section
        return { conversations: [...pinnedConvs, targetConv, ...otherConvs] };
      }
    });
  },

  // Update conversation's last_message status (for real-time status indicator updates)
  updateConversationMessageStatus: (messageId, status) => {
    set((state) => {
      // First, find which conversation this message belongs to by checking messages Map
      let targetUserId: number | null = null;
      
      for (const [userId, messages] of state.messages.entries()) {
        const foundMessage = messages.find(m => m.id === messageId);
        if (foundMessage) {
          // Check if this is the last message for this user
          const lastMsg = messages[messages.length - 1];
          if (lastMsg && lastMsg.id === messageId) {
            targetUserId = userId;
          }
          break;
        }
      }

      const conversations = state.conversations.map(conv => {
        // Update if: 1) last_message.id matches, OR 2) this is the target conversation from messages
        const shouldUpdate = 
          (conv.last_message && conv.last_message.id === messageId) ||
          (targetUserId !== null && conv.user_id === targetUserId && conv.last_message);
        
        if (shouldUpdate && conv.last_message) {
          console.log('📬 Updating conversation status:', conv.user_id, status);
          return {
            ...conv,
            last_message: {
              ...conv.last_message,
              ...(status === 'delivered' && { delivered_at: new Date().toISOString() }),
              ...(status === 'read' && { read_at: new Date().toISOString() }),
            }
          };
        }
        return conv;
      });
      return { conversations };
    });
  },

  updateUserStatus: (userId, status) => {
    set((state) => {
      const conversations = state.conversations.map(conv =>
        conv.user_id === userId 
          ? { 
              ...conv, 
              status,
              last_seen: status === 'offline' ? new Date().toISOString() : conv.last_seen
            } 
          : conv
      );
      return { conversations };
    });
  },

  pinConversation: (userId) => {
    set((state) => {
      const conversations = state.conversations.map(conv =>
        conv.user_id === userId ? { ...conv, is_pinned: !conv.is_pinned } : conv
      );
      
      // Sort: pinned first, then unpinned
      const pinnedConvs = conversations.filter(c => c.is_pinned);
      const unpinnedConvs = conversations.filter(c => !c.is_pinned);
      
      const sortedConversations = [...pinnedConvs, ...unpinnedConvs];
      
      // Save pinned conversation IDs to localStorage
      if (typeof window !== 'undefined') {
        const pinnedIds = pinnedConvs.map(c => c.user_id);
        localStorage.setItem('pinned_conversations', JSON.stringify(pinnedIds));
      }
      
      return { conversations: sortedConversations };
    });
  },

  deleteConversation: (userId) => {
    set((state) => {
      const conversations = state.conversations.filter(c => c.user_id !== userId);
      const newMessages = new Map(state.messages);
      newMessages.delete(userId);
      
      return { 
        conversations,
        messages: newMessages,
        activeConversationId: state.activeConversationId === userId ? null : state.activeConversationId
      };
    });
  },
}));
