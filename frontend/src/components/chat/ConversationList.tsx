'use client';

import { useState } from 'react';
import { Pin } from 'lucide-react';
import type { Conversation } from '@/types/chat';
import { useChatStore } from '@/store/chatStore';
import api from '@/lib/api';
import ContextMenu from './ContextMenu';
import DeleteConfirmModal from './DeleteConfirmModal';

interface ConversationListProps {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (userId: number) => void;
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
}: ConversationListProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    conversationId: number;
  } | null>(null);
  
  const [deleteModal, setDeleteModal] = useState<{
    conversationId: number;
    conversationName: string;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, userId: number) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      conversationId: userId,
    });
  };

  const handleDelete = () => {
    if (contextMenu?.conversationId) {
      // Find conversation name
      const conv = conversations.find(c => c.user_id === contextMenu.conversationId);
      if (conv) {
        setDeleteModal({
          conversationId: contextMenu.conversationId,
          conversationName: conv.name,
        });
      }
      setContextMenu(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    
    try {
      // Call backend API to delete conversation
      await api.delete(`/chat/conversations/${deleteModal.conversationId}`);
      
      // Delete from local store
      const deleteConversation = useChatStore.getState().deleteConversation;
      deleteConversation(deleteModal.conversationId);
      
      console.log('Deleted conversation:', deleteModal.conversationId);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setDeleteModal(null);
    }
  };

  const handleBlock = () => {
    console.log('Block user:', contextMenu?.conversationId);
    // TODO: Implement block user
  };

  const handleMute = () => {
    console.log('Mute conversation:', contextMenu?.conversationId);
    // TODO: Implement mute conversation
  };

  const handlePin = () => {
    if (contextMenu?.conversationId) {
      // Toggle pin status
      const pinConversation = useChatStore.getState().pinConversation;
      pinConversation(contextMenu.conversationId);
      
      console.log('Toggled pin for conversation:', contextMenu.conversationId);
    }
  };

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Check if conversation is pinned
  const isPinned = contextMenu 
    ? conversations.find(c => c.user_id === contextMenu.conversationId)?.is_pinned 
    : false;

  return (
    <>
      <div className="divide-y divide-gray-100">
        {conversations.map((conv) => (
          <div
            key={conv.user_id}
            onClick={() => onSelect(conv.user_id)}
            onContextMenu={(e) => handleContextMenu(e, conv.user_id)}
            className={`flex items-center gap-3 p-4 cursor-pointer transition ${
              activeId === conv.user_id
                ? 'bg-primary-50 border-l-4 border-primary-600'
                : 'hover:bg-gray-50'
            }`}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                {conv.name.charAt(0).toUpperCase()}
              </div>
              {conv.status === 'online' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {conv.name}
                  </h3>
                  {conv.is_pinned && (
                    <Pin className="w-3 h-3 text-primary-600 fill-current flex-shrink-0" />
                  )}
                </div>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                  {formatTime(conv.last_message?.sent_at)}
                </span>
              </div>
              <p className="text-sm text-gray-600 truncate">
                {conv.last_message?.content || 'No messages yet'}
              </p>
            </div>

            {/* Unread Badge */}
            {conv.unread_count > 0 && (
              <div className="flex-shrink-0">
                <div className="bg-primary-600 text-white text-xs font-medium rounded-full w-5 h-5 flex items-center justify-center">
                  {conv.unread_count > 9 ? '9+' : conv.unread_count}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDelete={handleDelete}
          onBlock={handleBlock}
          onMute={handleMute}
          onPin={handlePin}
          isPinned={isPinned}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <DeleteConfirmModal
          isOpen={true}
          conversationName={deleteModal.conversationName}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </>
  );
}
