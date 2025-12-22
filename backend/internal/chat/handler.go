package chat

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/yourusername/svara/internal/auth"
	"github.com/yourusername/svara/pkg/response"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development
		// In production, check against allowed origins
		return true
	},
}

// Handler handles WebSocket connections
type Handler struct {
	hub *Hub
	db  *sql.DB
}

// NewHandler creates a new chat handler
func NewHandler(db *sql.DB) *Handler {
	hub := NewHub(db)
	go hub.Run()

	return &Handler{
		hub: hub,
		db:  db,
	}
}

// HandleWebSocket handles WebSocket upgrade and connection
func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Create new client
	client := NewClient(h.hub, conn, claims.UserID)

	// Register client
	h.hub.register <- client

	// Start client goroutines
	go client.writePump()
	go client.readPump()
}

// GetMessages returns chat history between two users
func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	// Get other user ID from query params
	otherUserID := r.URL.Query().Get("user_id")
	if otherUserID == "" {
		response.BadRequest(w, "user_id is required")
		return
	}

	// Get messages from database
	rows, err := h.db.Query(
		`SELECT id, sender_id, receiver_id, content, encrypted, sent_at, delivered_at, read_at
		 FROM messages
		 WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		 ORDER BY sent_at DESC
		 LIMIT 50`,
		claims.UserID, otherUserID, otherUserID, claims.UserID,
	)
	if err != nil {
		response.InternalError(w, "Failed to fetch messages")
		return
	}
	defer rows.Close()

	messages := []Message{}
	for rows.Next() {
		var msg Message
		err := rows.Scan(
			&msg.ID, &msg.SenderID, &msg.ReceiverID, &msg.Content,
			&msg.Encrypted, &msg.SentAt, &msg.DeliveredAt, &msg.ReadAt,
		)
		if err != nil {
			continue
		}
		messages = append(messages, msg)
	}

	response.Success(w, "Messages retrieved", messages)
}

// GetConversations returns list of conversations for the user
func (h *Handler) GetConversations(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	// Get conversations with last message
	rows, err := h.db.Query(
		`SELECT DISTINCT
			CASE 
				WHEN m.sender_id = ? THEN m.receiver_id 
				ELSE m.sender_id 
			END as other_user_id,
			u.name,
			u.avatar_url,
			u.status,
			u.last_seen,
			(SELECT content FROM messages 
			 WHERE (sender_id = ? AND receiver_id = other_user_id) 
				OR (sender_id = other_user_id AND receiver_id = ?)
			 ORDER BY sent_at DESC LIMIT 1) as last_message,
			(SELECT COUNT(*) FROM messages 
			 WHERE receiver_id = ? AND sender_id = other_user_id AND read_at IS NULL) as unread_count
		FROM messages m
		JOIN users u ON u.id = other_user_id
		WHERE m.sender_id = ? OR m.receiver_id = ?
		ORDER BY m.sent_at DESC`,
		claims.UserID, claims.UserID, claims.UserID, claims.UserID, claims.UserID, claims.UserID,
	)
	if err != nil {
		response.InternalError(w, "Failed to fetch conversations")
		return
	}
	defer rows.Close()

	type Conversation struct {
		UserID      int     `json:"user_id"`
		Name        string  `json:"name"`
		AvatarURL   *string `json:"avatar_url"`
		Status      string  `json:"status"`
		LastSeen    *string `json:"last_seen"`
		LastMessage *string `json:"last_message"`
		UnreadCount int     `json:"unread_count"`
	}

	conversations := []Conversation{}
	for rows.Next() {
		var conv Conversation
		err := rows.Scan(
			&conv.UserID, &conv.Name, &conv.AvatarURL, &conv.Status,
			&conv.LastSeen, &conv.LastMessage, &conv.UnreadCount,
		)
		if err != nil {
			continue
		}
		conversations = append(conversations, conv)
	}

	response.Success(w, "Conversations retrieved", conversations)
}
