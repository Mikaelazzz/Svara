import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '@/types/chat';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export default function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = () => {
    if (!isOwn) return null;

    if (message.read_at) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    } else if (message.delivered_at) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    } else {
      return <Check className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 ${
          isOwn
            ? 'bg-primary-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
        }`}
      >
        <p className="text-sm break-words">{message.content}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          <span
            className={`text-xs ${
              isOwn ? 'text-primary-100' : 'text-gray-500'
            }`}
          >
            {formatTime(message.sent_at)}
          </span>
          {getStatusIcon()}
        </div>
      </div>
    </div>
  );
}
