package chat

import (
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
	"github.com/yourusername/svara/internal/auth"
	"github.com/yourusername/svara/pkg/response"
)

type Handler struct {
	hub *Hub
	db  *sql.DB
}

func NewHandler(hub *Hub, db *sql.DB) *Handler {
	return &Handler{
		hub: hub,
		db:  db,
	}
}

// GetConversations returns all conversations for the current user
func (h *Handler) GetConversations(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	// Query uses deleted_conversations table to filter out deleted messages by timestamp
	// Messages sent AFTER deleted_at are still visible (allowing new conversations)
	rows, err := h.db.Query(`
		SELECT DISTINCT
			u.id as other_user_id,
			u.name,
			u.status,
			u.last_seen,
			(SELECT content FROM messages m2 
			 LEFT JOIN deleted_conversations dc2 ON dc2.user_id = ? AND dc2.other_user_id = u.id
			 WHERE ((m2.sender_id = ? AND m2.receiver_id = u.id) OR (m2.sender_id = u.id AND m2.receiver_id = ?))
			 AND (dc2.deleted_at IS NULL OR m2.sent_at > dc2.deleted_at)
			 ORDER BY m2.sent_at DESC LIMIT 1) as last_message_content,
			(SELECT sent_at FROM messages m2 
			 LEFT JOIN deleted_conversations dc2 ON dc2.user_id = ? AND dc2.other_user_id = u.id
			 WHERE ((m2.sender_id = ? AND m2.receiver_id = u.id) OR (m2.sender_id = u.id AND m2.receiver_id = ?))
			 AND (dc2.deleted_at IS NULL OR m2.sent_at > dc2.deleted_at)
			 ORDER BY m2.sent_at DESC LIMIT 1) as last_message_time,
			(SELECT COUNT(*) FROM messages m2 
			 LEFT JOIN deleted_conversations dc2 ON dc2.user_id = ? AND dc2.other_user_id = u.id
			 WHERE m2.sender_id = u.id AND m2.receiver_id = ? AND m2.read_at IS NULL
			 AND (dc2.deleted_at IS NULL OR m2.sent_at > dc2.deleted_at)) as unread_count
		FROM users u
		WHERE EXISTS (
			SELECT 1 FROM messages m
			LEFT JOIN deleted_conversations dc ON dc.user_id = ? AND dc.other_user_id = u.id
			WHERE ((m.sender_id = ? AND m.receiver_id = u.id) OR (m.sender_id = u.id AND m.receiver_id = ?))
			AND (dc.deleted_at IS NULL OR m.sent_at > dc.deleted_at)
		)
		AND u.id != ?
		ORDER BY last_message_time DESC
	`, claims.UserID, claims.UserID, claims.UserID,
		claims.UserID, claims.UserID, claims.UserID,
		claims.UserID, claims.UserID,
		claims.UserID, claims.UserID, claims.UserID,
		claims.UserID)

	if err != nil {
		log.Printf("Failed to get conversations: %v", err)
		response.InternalError(w, "Failed to get conversations")
		return
	}
	defer rows.Close()

	var conversations []Conversation
	for rows.Next() {
		var conv Conversation
		var lastMessageContent, lastMessageTime sql.NullString

		err := rows.Scan(
			&conv.UserID,
			&conv.Name,
			&conv.Status,
			&conv.LastSeen,
			&lastMessageContent,
			&lastMessageTime,
			&conv.UnreadCount,
		)
		if err != nil {
			log.Printf("Failed to scan conversation: %v", err)
			continue
		}

		// Skip conversations where all messages are deleted (last_message_content is NULL)
		if !lastMessageContent.Valid || lastMessageContent.String == "" {
			log.Printf("Skipping conversation with user %d - no visible messages", conv.UserID)
			continue
		}

		if lastMessageContent.Valid && lastMessageTime.Valid {
			sentTime, err := time.Parse(time.RFC3339, lastMessageTime.String)
			if err != nil {
				sentTime = time.Now()
			}
			conv.LastMessage = &Message{
				Content: lastMessageContent.String,
				SentAt:  sentTime,
			}
		}

		conversations = append(conversations, conv)
	}

	response.Success(w, "Conversations retrieved successfully", conversations)
}

// GetMessages returns all messages between current user and specified user
func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	otherUserIDStr := r.URL.Query().Get("user_id")
	otherUserID, err := strconv.Atoi(otherUserIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	// Get messages between two users, filtering by deletion timestamp
	// Messages sent AFTER deleted_at are visible (if exists), otherwise all messages visible
	rows, err := h.db.Query(
		`SELECT m.id, m.sender_id, m.receiver_id, m.content, m.sent_at, m.delivered_at, m.read_at
		 FROM messages m
		 LEFT JOIN deleted_conversations dc ON dc.user_id = ? AND dc.other_user_id = ?
		 WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
		 AND (dc.deleted_at IS NULL OR m.sent_at > dc.deleted_at)
		 ORDER BY m.sent_at ASC`,
		claims.UserID, otherUserID, claims.UserID, otherUserID, otherUserID, claims.UserID,
	)
	if err != nil {
		log.Printf("Failed to get messages: %v", err)
		response.InternalError(w, "Failed to get messages")
		return
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
		var deliveredAt, readAt sql.NullTime

		err := rows.Scan(
			&msg.ID,
			&msg.SenderID,
			&msg.ReceiverID,
			&msg.Content,
			&msg.SentAt,
			&deliveredAt,
			&readAt,
		)
		if err != nil {
			log.Printf("Failed to scan message: %v", err)
			continue
		}

		if deliveredAt.Valid {
			msg.DeliveredAt = &deliveredAt.Time
		}
		if readAt.Valid {
			msg.ReadAt = &readAt.Time
		}

		messages = append(messages, msg)
	}

	response.Success(w, "Messages retrieved successfully", messages)
}

// SearchUsers searches for users by name, email, or phone
func (h *Handler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		response.BadRequest(w, "Search query is required")
		return
	}

	rows, err := h.db.Query(
		`SELECT id, name, email, phone, status, last_seen 
		 FROM users 
		 WHERE id != ? AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)
		 LIMIT 10`,
		claims.UserID, "%"+query+"%", "%"+query+"%", "%"+query+"%",
	)
	if err != nil {
		log.Printf("Failed to search users: %v", err)
		response.InternalError(w, "Failed to search users")
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var email, phone, lastSeen sql.NullString

		err := rows.Scan(
			&user.ID,
			&user.Name,
			&email,
			&phone,
			&user.Status,
			&lastSeen,
		)
		if err != nil {
			log.Printf("Failed to scan user: %v", err)
			continue
		}

		if email.Valid {
			user.Email = email.String
		}
		if phone.Valid {
			user.Phone = phone.String
		}
		if lastSeen.Valid {
			user.LastSeen = lastSeen.String
		}

		users = append(users, user)
	}

	response.Success(w, "Users found", users)
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// HandleWebSocket handles WebSocket connections
func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		log.Printf("Unauthorized WebSocket connection attempt")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Update user status to online
	_, err := h.db.Exec("UPDATE users SET status = 'online', last_seen = ? WHERE id = ?",
		time.Now().Format(time.RFC3339), claims.UserID)
	if err != nil {
		log.Printf("Failed to update user status: %v", err)
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	log.Printf("WebSocket connected for user: %d", claims.UserID)

	client := NewClient(h.hub, conn, claims.UserID)
	h.hub.register <- client

	go client.writePump()
	go client.readPump()
}
