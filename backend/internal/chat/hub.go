package chat

import (
	"database/sql"
	"encoding/json"
	"log"
	"sync"
	"time"
)

// ClientMessage represents a message from a client
type ClientMessage struct {
	client  *Client
	message *WSMessage
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	// Registered clients (userID -> client)
	clients map[int]*Client

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Handle incoming messages
	handleMessage chan *ClientMessage

	// Database connection
	db *sql.DB

	// Mutex for thread-safe operations
	mu sync.RWMutex
}

// NewHub creates a new Hub
func NewHub(db *sql.DB) *Hub {
	return &Hub{
		clients:       make(map[int]*Client),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		handleMessage: make(chan *ClientMessage),
		db:            db,
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case clientMsg := <-h.handleMessage:
			h.processMessage(clientMsg)
		}
	}
}

// registerClient registers a new client
func (h *Hub) registerClient(client *Client) {
	h.mu.Lock()
	h.clients[client.userID] = client
	h.mu.Unlock()

	// Update user status to online
	h.updateUserStatus(client.userID, "online")

	// Notify other users that this user is online
	h.broadcastUserStatus(client.userID, "online")

	log.Printf("Client registered: user_id=%d, total_clients=%d", client.userID, len(h.clients))
}

// unregisterClient unregisters a client
func (h *Hub) unregisterClient(client *Client) {
	h.mu.Lock()
	if _, ok := h.clients[client.userID]; ok {
		delete(h.clients, client.userID)
		close(client.send)
	}
	h.mu.Unlock()

	// Update user status to offline
	h.updateUserStatus(client.userID, "offline")

	// Notify other users that this user is offline
	h.broadcastUserStatus(client.userID, "offline")

	log.Printf("Client unregistered: user_id=%d, total_clients=%d", client.userID, len(h.clients))
}

// processMessage processes incoming messages from clients
func (h *Hub) processMessage(clientMsg *ClientMessage) {
	switch clientMsg.message.Type {
	case "message":
		h.handleChatMessage(clientMsg)
	case "typing":
		h.handleTypingIndicator(clientMsg)
	case "receipt":
		h.handleMessageReceipt(clientMsg)
	default:
		log.Printf("Unknown message type: %s", clientMsg.message.Type)
	}
}

// handleChatMessage handles incoming chat messages
func (h *Hub) handleChatMessage(clientMsg *ClientMessage) {
	// Parse payload
	payloadBytes, _ := json.Marshal(clientMsg.message.Payload)
	var payload MessagePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		log.Printf("Failed to parse message payload: %v", err)
		return
	}

	// Save message to database
	result, err := h.db.Exec(
		`INSERT INTO messages (sender_id, receiver_id, content, sent_at) VALUES (?, ?, ?, ?)`,
		clientMsg.client.userID, payload.ReceiverID, payload.Content, time.Now(),
	)
	if err != nil {
		log.Printf("Failed to save message: %v", err)
		return
	}

	messageID, _ := result.LastInsertId()

	// Create message object
	msg := Message{
		ID:         int(messageID),
		SenderID:   clientMsg.client.userID,
		ReceiverID: payload.ReceiverID,
		Content:    payload.Content,
		SentAt:     time.Now(),
	}

	// Send to sender (confirmation)
	clientMsg.client.SendMessage("message_sent", msg)

	// Send to receiver if online
	h.mu.RLock()
	receiverClient, online := h.clients[payload.ReceiverID]
	h.mu.RUnlock()

	if online {
		receiverClient.SendMessage("message", msg)

		// Auto-mark as delivered
		now := time.Now()
		h.db.Exec(`UPDATE messages SET delivered_at = ? WHERE id = ?`, now, messageID)
		msg.DeliveredAt = &now

		// Send delivery receipt to sender
		clientMsg.client.SendMessage("receipt", map[string]interface{}{
			"message_id": messageID,
			"status":     "delivered",
		})
	}
}

// handleTypingIndicator handles typing indicators
func (h *Hub) handleTypingIndicator(clientMsg *ClientMessage) {
	payloadBytes, _ := json.Marshal(clientMsg.message.Payload)
	var payload TypingPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	// Send typing indicator to receiver if online
	h.mu.RLock()
	receiverClient, online := h.clients[payload.ReceiverID]
	h.mu.RUnlock()

	if online {
		receiverClient.SendMessage("typing", map[string]interface{}{
			"user_id":   clientMsg.client.userID,
			"is_typing": payload.IsTyping,
		})
	}
}

// handleMessageReceipt handles message read receipts
func (h *Hub) handleMessageReceipt(clientMsg *ClientMessage) {
	payloadBytes, _ := json.Marshal(clientMsg.message.Payload)
	var payload ReceiptPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return
	}

	now := time.Now()

	if payload.Status == "delivered" {
		h.db.Exec(`UPDATE messages SET delivered_at = ? WHERE id = ? AND delivered_at IS NULL`, now, payload.MessageID)
	} else if payload.Status == "read" {
		h.db.Exec(`UPDATE messages SET read_at = ? WHERE id = ? AND read_at IS NULL`, now, payload.MessageID)
	}

	// Get message sender
	var senderID int
	err := h.db.QueryRow(`SELECT sender_id FROM messages WHERE id = ?`, payload.MessageID).Scan(&senderID)
	if err != nil {
		return
	}

	// Send receipt to sender if online
	h.mu.RLock()
	senderClient, online := h.clients[senderID]
	h.mu.RUnlock()

	if online {
		senderClient.SendMessage("receipt", map[string]interface{}{
			"message_id": payload.MessageID,
			"status":     payload.Status,
		})
	}
}

// updateUserStatus updates user status in database
func (h *Hub) updateUserStatus(userID int, status string) {
	_, err := h.db.Exec(
		`UPDATE users SET status = ?, last_seen = ? WHERE id = ?`,
		status, time.Now(), userID,
	)
	if err != nil {
		log.Printf("Failed to update user status: %v", err)
	}
}

// broadcastUserStatus broadcasts user status to all connected clients
func (h *Hub) broadcastUserStatus(userID int, status string) {
	userStatus := UserStatus{
		UserID:   userID,
		Status:   status,
		LastSeen: time.Now(),
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		if client.userID != userID {
			client.SendMessage("user_status", userStatus)
		}
	}
}

// GetOnlineUsers returns list of online user IDs
func (h *Hub) GetOnlineUsers() []int {
	h.mu.RLock()
	defer h.mu.RUnlock()

	users := make([]int, 0, len(h.clients))
	for userID := range h.clients {
		users = append(users, userID)
	}
	return users
}
