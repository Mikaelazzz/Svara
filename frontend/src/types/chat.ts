export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  encrypted: boolean;
  sent_at: string;
  delivered_at?: string;
  read_at?: string;
}

export interface Conversation {
  user_id: number;
  name: string;
  avatar_url?: string;
  status: 'online' | 'offline';
  last_seen?: string;
  last_message?: Message;
  unread_count: number;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
