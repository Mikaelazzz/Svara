package chat

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512 * 1024
)

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	Send   chan []byte // Exported for WebRTC signaling
	UserID int         // Exported for WebRTC signaling
	mu     sync.Mutex
}

func NewClient(hub *Hub, conn *websocket.Conn, userID int) *Client {
	return &Client{
		hub:    hub,
		conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID,
	}
}

func (c *Client) cleanup() {
	// Update user status to offline when disconnecting
	_, err := c.hub.db.Exec("UPDATE users SET status = 'offline', last_seen = datetime('now') WHERE id = ?", c.UserID)
	if err != nil {
		log.Printf("Failed to update user status on disconnect: %v", err)
	}
	log.Printf("User %d disconnected and set to offline", c.UserID)
}

func (c *Client) readPump() {
	defer func() {
		c.cleanup() // Update status before unregistering
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	c.conn.SetReadLimit(maxMessageSize)

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		var wsMsg WSMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Printf("Failed to parse message: %v", err)
			continue
		}

		c.hub.handleMessage <- &ClientMessage{
			client:  c,
			message: &wsMsg,
		}
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) SendMessage(msgType string, payload interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	wsMsg := WSMessage{
		Type:    msgType,
		Payload: payload,
	}

	data, err := json.Marshal(wsMsg)
	if err != nil {
		return err
	}

	select {
	case c.Send <- data:
		return nil
	default:
		return nil
	}
}
