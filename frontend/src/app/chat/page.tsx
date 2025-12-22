'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Search, MessageCircle, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import api from '@/lib/api';

import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import NewChatModal from '@/components/chat/NewChatModal';

export default function ChatPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  
  const conversations = useChatStore((state) => state.conversations);
  const setConversations = useChatStore((state) => state.setConversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversation = useChatStore((state) => state.setActiveConversation);
  const markAsRead = useChatStore((state) => state.markAsRead);

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Initialize WebSocket
  const { isConnected } = useWebSocket(accessToken);

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const response = await api.get('/chat/conversations');
        setConversations(response.data.data || []);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [setConversations]);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Svara</h2>
              <p className="text-xs text-gray-500">
                {isConnected ? (
                  <span className="text-green-600">● Connected</span>
                ) : (
                  <span className="text-gray-400">○ Connecting...</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewChatModal(true)}
                className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
                title="New Chat"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">Loading...</div>
            </div>
          ) : filteredConversations.length > 0 ? (
            <ConversationList
              conversations={filteredConversations}
              activeId={activeConversationId}
              onSelect={(userId) => {
                setActiveConversation(userId);
                markAsRead(userId);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <MessageCircle className="w-12 h-12 mb-2" />
              <p className="text-sm">No conversations yet</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Start a new chat
              </button>
            </div>
          )}
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-medium">
              {user?.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || user?.phone}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1">
        {activeConversationId ? (
          <ChatWindow 
            userId={activeConversationId} 
            onClose={() => setActiveConversation(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-600 mb-2">
                Select a conversation
              </h3>
              <p className="text-gray-400 mb-4">
                Choose a conversation from the sidebar to start chatting
              </p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
              >
                Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onSelectUser={(userId) => setActiveConversation(userId)}
      />
    </div>
  );
}
