import type { Conversation } from '@/types/chat';

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
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      // Today - show time in 24-hour format
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <button
          key={conv.user_id}
          onClick={() => onSelect(conv.user_id)}
          className={`w-full p-4 hover:bg-gray-50 transition text-left ${
            activeId === conv.user_id ? 'bg-primary-50' : ''
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium text-lg">
                {conv.name.charAt(0).toUpperCase()}
              </div>
              {conv.status === 'online' && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-semibold text-gray-900 truncate">
                  {conv.name}
                </h3>
                {conv.last_message && (
                  <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                    {formatTime(conv.last_message.sent_at)}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 truncate">
                  {conv.last_message?.content || 'No messages yet'}
                </p>
                {conv.unread_count > 0 && (
                  <span className="ml-2 bg-primary-500 text-white text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                    {conv.unread_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
