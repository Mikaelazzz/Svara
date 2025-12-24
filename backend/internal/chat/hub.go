package chat

import (
	"database/sql"
	"encoding/json"
	"log"
	"time"
)

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	clients          map[int]*Client
	broadcast        chan []byte
	register         chan *Client
	unregister       chan *Client
	handleMessage    chan *ClientMessage
	db               *sql.DB
	signalingHandler interface{} // Will be set to *webrtc.SignalingHandler
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
			h.clients[client.UserID] = client
			log.Printf("Client registered: %d, total clients: %d", client.UserID, len(h.clients))

			// Broadcast user online status to all clients
			h.broadcastUserStatus(client.UserID, "online")

		case client := <-h.unregister:
			if _, ok := h.clients[client.UserID]; ok {
				delete(h.clients, client.UserID)
				close(client.Send)
				log.Printf("Client unregistered: %d, total clients: %d", client.UserID, len(h.clients))

				// Clean up any active calls
				if h.signalingHandler != nil {
					if handler, ok := h.signalingHandler.(interface {
						OnClientDisconnect(int64)
					}); ok {
						handler.OnClientDisconnect(int64(client.UserID))
					}
				}

				// Broadcast user offline status to all clients
				h.broadcastUserStatus(client.UserID, "offline")
			}

		case clientMsg := <-h.handleMessage:
			h.processMessage(clientMsg)

		case message := <-h.broadcast:
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.UserID)
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
		case client.Send <- data:
		default:
			log.Printf("Failed to send status update to client %d", client.UserID)
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
	case "call-request", "call-accept", "call-reject", "call-end", "call-cancel",
		"offer", "answer", "ice-candidate":
		// Handle WebRTC signaling messages
		log.Printf("🔔 Received signaling message: %s from user %d", clientMsg.message.Type, clientMsg.client.UserID)

		if h.signalingHandler != nil {
			// Flatten the payload structure for signaling handler
			// Frontend sends: {type: "...", payload: {...}}
			// Signaling handler expects: {type: "...", field1: value1, ...}
			flattenedMsg := map[string]interface{}{
				"type": clientMsg.message.Type,
			}

			// Copy payload fields to top level
			if payload, ok := clientMsg.message.Payload.(map[string]interface{}); ok {
				for key, value := range payload {
					flattenedMsg[key] = value
				}
			}

			// Convert to JSON for signaling handler
			data, err := json.Marshal(flattenedMsg)
			if err != nil {
				log.Printf("❌ Failed to marshal signaling message: %v", err)
				return
			}

			log.Printf("📤 Forwarding to signaling handler: %s", string(data))

			// Call signaling handler via reflection to avoid circular import
			// The actual handler will be set from main.go
			if handler, ok := h.signalingHandler.(interface {
				HandleSignalingMessage(*Client, []byte)
			}); ok {
				handler.HandleSignalingMessage(clientMsg.client, data)
			} else {
				log.Printf("❌ Signaling handler does not implement HandleSignalingMessage")
			}
		} else {
			log.Printf("❌ Signaling handler is nil!")
		}
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
		clientMsg.client.UserID, receiverID, content, false, time.Now(),
	)
	if err != nil {
		log.Printf("Failed to save message: %v", err)
		return
	}

	messageID, _ := result.LastInsertId()

	// Create message response
	msg := Message{
		ID:         int(messageID),
		SenderID:   clientMsg.client.UserID,
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
			"user_id":   clientMsg.client.UserID,
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

// SetSignalingHandler sets the WebRTC signaling handler
func (h *Hub) SetSignalingHandler(handler interface{}) {
	h.signalingHandler = handler
}

// GetClient returns a client by user ID
func (h *Hub) GetClient(userID int64) *Client {
	log.Printf("🔍 Looking for client with userID: %d", userID)
	log.Printf("📋 Current clients: %v", func() []int {
		ids := make([]int, 0, len(h.clients))
		for id := range h.clients {
			ids = append(ids, id)
		}
		return ids
	}())

	client, ok := h.clients[int(userID)]
	if !ok {
		log.Printf("❌ Client %d NOT FOUND in hub!", userID)
		return nil
	}

	log.Printf("✅ Found client %d", userID)
	return client
}
