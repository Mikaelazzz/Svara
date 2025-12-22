package chat

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"
)

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients       map[int]*Client
	broadcast     chan []byte
	register      chan *Client
	unregister    chan *Client
	handleMessage chan *ClientMessage
	db            *sql.DB
}

type ClientMessage struct {
	client  *Client
	message *WSMessage
}

func NewHub(db *sql.DB) *Hub {
	return &Hub{
		clients:       make(map[int]*Client),
		broadcast:     make(chan []byte),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		handleMessage: make(chan *ClientMessage),
		db:            db,
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client.userID] = client
			log.Printf("Client registered: %d, total clients: %d", client.userID, len(h.clients))

			// Broadcast user online status to all clients
			h.broadcastUserStatus(client.userID, "online")

		case client := <-h.unregister:
			if _, ok := h.clients[client.userID]; ok {
				delete(h.clients, client.userID)
				close(client.send)
				log.Printf("Client unregistered: %d, total clients: %d", client.userID, len(h.clients))

				// Broadcast user offline status to all clients
				h.broadcastUserStatus(client.userID, "offline")
			}

		case clientMsg := <-h.handleMessage:
			h.processMessage(clientMsg)

		case message := <-h.broadcast:
			for _, client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client.userID)
				}
			}
		}
	}
}

func (h *Hub) broadcastUserStatus(userID int, status string) {
	statusMsg := WSMessage{
		Type: "user_status",
		Payload: map[string]interface{}{
			"user_id": userID,
			"status":  status,
		},
	}

	data, err := json.Marshal(statusMsg)
	if err != nil {
		log.Printf("Failed to marshal status message: %v", err)
		return
	}

	// Broadcast to all connected clients
	for _, client := range h.clients {
		select {
		case client.send <- data:
		default:
			log.Printf("Failed to send status update to client %d", client.userID)
		}
	}
}

func (h *Hub) processMessage(clientMsg *ClientMessage) {
	switch clientMsg.message.Type {
	case "message":
		h.handleChatMessage(clientMsg)
	case "typing":
		h.handleTypingIndicator(clientMsg)
	case "receipt":
		h.handleReceipt(clientMsg)
	default:
		log.Printf("Unknown message type: %s", clientMsg.message.Type)
	}
}

func (h *Hub) handleChatMessage(clientMsg *ClientMessage) {
	payload, ok := clientMsg.message.Payload.(map[string]interface{})
	if !ok {
		log.Printf("Invalid message payload")
		return
	}

	receiverID := int(payload["receiver_id"].(float64))
	content := payload["content"].(string)

	// Save message to database
	result, err := h.db.Exec(
		`INSERT INTO messages (sender_id, receiver_id, content, encrypted, sent_at) 
		 VALUES (?, ?, ?, ?, ?)`,
		clientMsg.client.userID, receiverID, content, false, time.Now(),
	)
	if err != nil {
		log.Printf("Failed to save message: %v", err)
		return
	}

	messageID, _ := result.LastInsertId()

	// Create message response
	msg := Message{
		ID:         int(messageID),
		SenderID:   clientMsg.client.userID,
		ReceiverID: receiverID,
		Content:    content,
		Encrypted:  false,
		SentAt:     time.Now(),
	}

	// Send to receiver if online
	if receiverClient, ok := h.clients[receiverID]; ok {
		receiverClient.SendMessage("message", msg)
	}

	// Send confirmation to sender
	clientMsg.client.SendMessage("message_sent", msg)
}

func (h *Hub) handleTypingIndicator(clientMsg *ClientMessage) {
	payload, ok := clientMsg.message.Payload.(map[string]interface{})
	if !ok {
		return
	}

	receiverID := int(payload["receiver_id"].(float64))
	isTyping := payload["is_typing"].(bool)

	if receiverClient, ok := h.clients[receiverID]; ok {
		receiverClient.SendMessage("typing", map[string]interface{}{
			"user_id":   clientMsg.client.userID,
			"is_typing": isTyping,
		})
	}
}

func (h *Hub) handleReceipt(clientMsg *ClientMessage) {
	payload, ok := clientMsg.message.Payload.(map[string]interface{})
	if !ok {
		return
	}

	messageID := int(payload["message_id"].(float64))
	status := payload["status"].(string)

	// Update message status in database
	var column string
	switch status {
	case "delivered":
		column = "delivered_at"
	case "read":
		column = "read_at"
	default:
		return
	}

	_, err := h.db.Exec(
		"UPDATE messages SET "+column+" = ? WHERE id = ?",
		time.Now(), messageID,
	)
	if err != nil {
		log.Printf("Failed to update message status: %v", err)
		return
	}

	// Get sender ID to send receipt
	var senderID int
	err = h.db.QueryRow("SELECT sender_id FROM messages WHERE id = ?", messageID).Scan(&senderID)
	if err != nil {
		return
	}

	// Send receipt to sender if online
	if senderClient, ok := h.clients[senderID]; ok {
		senderClient.SendMessage("receipt", map[string]interface{}{
			"message_id": messageID,
			"status":     status,
		})
	}
}
