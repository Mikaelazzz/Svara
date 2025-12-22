package chat

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/yourusername/svara/internal/auth"
	"github.com/yourusername/svara/internal/config"
	"github.com/yourusername/svara/pkg/response"
	"github.com/yourusername/svara/pkg/utils"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Handler struct {
	hub    *Hub
	db     *sql.DB
	config *config.Config
}

func NewHandler(db *sql.DB, cfg *config.Config) *Handler {
	hub := NewHub(db)
	go hub.Run()

	return &Handler{
		hub:    hub,
		db:     db,
		config: cfg,
	}
}

func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Get token from query parameter (WebSocket doesn't support custom headers)
	token := r.URL.Query().Get("token")
	log.Printf("WebSocket connection attempt, token present: %v", token != "")

	if token == "" {
		log.Printf("WebSocket auth failed: no token provided")
		http.Error(w, "Token required", http.StatusUnauthorized)
		return
	}

	// Validate token
	claims, err := utils.ValidateToken(token, h.config.JWTSecret)
	if err != nil {
		log.Printf("WebSocket auth failed: invalid token - %v", err)
		http.Error(w, "Invalid token", http.StatusUnauthorized)
		return
	}

	log.Printf("WebSocket auth success for user: %d", claims.UserID)

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

func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	otherUserID := r.URL.Query().Get("user_id")
	if otherUserID == "" {
		response.BadRequest(w, "user_id is required")
		return
	}

	rows, err := h.db.Query(
		`SELECT id, sender_id, receiver_id, content, encrypted, sent_at, delivered_at, read_at
		 FROM messages
		 WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
		 ORDER BY sent_at ASC
		 LIMIT 50`,
		claims.UserID, otherUserID, otherUserID, claims.UserID,
	)
	if err != nil {
		log.Printf("Failed to fetch messages: %v", err)
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

func (h *Handler) GetConversations(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	type ConversationResponse struct {
		UserID      int     `json:"user_id"`
		Name        string  `json:"name"`
		AvatarURL   *string `json:"avatar_url"`
		Status      string  `json:"status"`
		LastMessage *struct {
			ID         int    `json:"id"`
			SenderID   int    `json:"sender_id"`
			ReceiverID int    `json:"receiver_id"`
			Content    string `json:"content"`
			SentAt     string `json:"sent_at"`
		} `json:"last_message"`
		UnreadCount int `json:"unread_count"`
	}

	log.Printf("Fetching conversations for user: %d", claims.UserID)

	// Get unique users that have chatted with current user
	userRows, err := h.db.Query(
		`SELECT DISTINCT
			CASE 
				WHEN sender_id = ? THEN receiver_id 
				ELSE sender_id 
			END as other_user_id
		FROM messages
		WHERE sender_id = ? OR receiver_id = ?`,
		claims.UserID, claims.UserID, claims.UserID,
	)
	if err != nil {
		log.Printf("Failed to fetch conversation users: %v", err)
		response.InternalError(w, "Failed to fetch conversations")
		return
	}
	defer userRows.Close()

	conversations := []ConversationResponse{}

	for userRows.Next() {
		var otherUserID int
		if err := userRows.Scan(&otherUserID); err != nil {
			continue
		}

		var conv ConversationResponse

		// Get user info
		err := h.db.QueryRow(
			`SELECT id, name, avatar_url, status FROM users WHERE id = ?`,
			otherUserID,
		).Scan(&conv.UserID, &conv.Name, &conv.AvatarURL, &conv.Status)

		if err != nil {
			log.Printf("Failed to get user info for %d: %v", otherUserID, err)
			continue
		}

		// Get last message
		var msgID, senderID, receiverID int
		var content, sentAt string
		err = h.db.QueryRow(
			`SELECT id, sender_id, receiver_id, content, sent_at
			 FROM messages
			 WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
			 ORDER BY sent_at DESC
			 LIMIT 1`,
			claims.UserID, otherUserID, otherUserID, claims.UserID,
		).Scan(&msgID, &senderID, &receiverID, &content, &sentAt)

		if err == nil {
			conv.LastMessage = &struct {
				ID         int    `json:"id"`
				SenderID   int    `json:"sender_id"`
				ReceiverID int    `json:"receiver_id"`
				Content    string `json:"content"`
				SentAt     string `json:"sent_at"`
			}{
				ID:         msgID,
				SenderID:   senderID,
				ReceiverID: receiverID,
				Content:    content,
				SentAt:     sentAt,
			}
		}

		// Get unread count
		err = h.db.QueryRow(
			`SELECT COUNT(*) FROM messages 
			 WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL`,
			otherUserID, claims.UserID,
		).Scan(&conv.UnreadCount)

		if err != nil {
			conv.UnreadCount = 0
		}

		conversations = append(conversations, conv)
	}

	log.Printf("Fetched %d conversations for user: %d", len(conversations), claims.UserID)
	response.Success(w, "Conversations retrieved", conversations)
}

// SearchUsers searches for users by name or email
func (h *Handler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		response.BadRequest(w, "search query is required")
		return
	}

	type UserResult struct {
		ID     int     `json:"id"`
		Name   string  `json:"name"`
		Email  *string `json:"email,omitempty"`
		Phone  *string `json:"phone,omitempty"`
		Status string  `json:"status"`
	}

	rows, err := h.db.Query(
		`SELECT id, name, email, phone, status 
		 FROM users 
		 WHERE id != ? AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)
		 LIMIT 20`,
		claims.UserID, "%"+query+"%", "%"+query+"%", "%"+query+"%",
	)
	if err != nil {
		log.Printf("Failed to search users: %v", err)
		response.InternalError(w, "Failed to search users")
		return
	}
	defer rows.Close()

	users := []UserResult{}
	for rows.Next() {
		var user UserResult
		err := rows.Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Status)
		if err != nil {
			continue
		}
		users = append(users, user)
	}

	response.Success(w, "Users found", users)
}
