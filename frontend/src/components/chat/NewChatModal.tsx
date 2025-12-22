'use client';

import { useState } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface User {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  status: string;
}

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: number, userName: string) => void;
}

export default function NewChatModal({ isOpen, onClose, onSelectUser }: NewChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/chat/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.data.data || []);
    } catch (error) {
      console.error('Failed to search users:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    onSelectUser(user.id, user.name);
    onClose();
    setSearchQuery('');
    setSearchResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">New Chat</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 transition"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className="w-full p-4 hover:bg-gray-50 transition text-left flex items-center gap-3"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium text-lg flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {user.name}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">
                      {user.email || user.phone}
                    </p>
                  </div>
                  {user.status === 'online' && (
                    <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ) : searchQuery.length >= 2 ? (
            <div className="py-8 text-center text-gray-400">
              No users found
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400">
              Type to search users
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
