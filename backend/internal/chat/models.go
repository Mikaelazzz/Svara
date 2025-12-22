package chat

import (
	"time"
)

// Message represents a chat message
type Message struct {
	ID          int        `json:"id"`
	SenderID    int        `json:"sender_id"`
	ReceiverID  int        `json:"receiver_id"`
	Content     string     `json:"content"`
	Encrypted   bool       `json:"encrypted"`
	SentAt      time.Time  `json:"sent_at"`
	DeliveredAt *time.Time `json:"delivered_at,omitempty"`
	ReadAt      *time.Time `json:"read_at,omitempty"`
}

// WSMessage represents WebSocket message format
type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// MessagePayload for sending messages
type MessagePayload struct {
	ReceiverID int    `json:"receiver_id"`
	Content    string `json:"content"`
}

// TypingPayload for typing indicators
type TypingPayload struct {
	ReceiverID int  `json:"receiver_id"`
	IsTyping   bool `json:"is_typing"`
}

// ReceiptPayload for message receipts
type ReceiptPayload struct {
	MessageID int    `json:"message_id"`
	Status    string `json:"status"` // "delivered" or "read"
}

// UserStatus for online/offline status
type UserStatus struct {
	UserID   int       `json:"user_id"`
	Status   string    `json:"status"` // "online" or "offline"
	LastSeen time.Time `json:"last_seen,omitempty"`
}
