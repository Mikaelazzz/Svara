package webrtc

import (
	"encoding/json"
	"log"
	"time"

	"github.com/yourusername/svara/internal/chat"
	"github.com/yourusername/svara/internal/database"
)

// SignalingHandler handles WebRTC signaling messages
type SignalingHandler struct {
	hub         *chat.Hub
	peerManager *PeerManager
	db          *database.Database
}

// NewSignalingHandler creates a new signaling handler
func NewSignalingHandler(hub *chat.Hub, db *database.Database) *SignalingHandler {
	return &SignalingHandler{
		hub:         hub,
		peerManager: NewPeerManager(),
		db:          db,
	}
}

// HandleSignalingMessage processes incoming signaling messages
func (sh *SignalingHandler) HandleSignalingMessage(client *chat.Client, message []byte) {
	log.Printf("🎯 SignalingHandler received message from user %d: %s", client.UserID, string(message))

	var sigMsg SignalingMessage
	if err := json.Unmarshal(message, &sigMsg); err != nil {
		log.Printf("❌ Error unmarshaling signaling message: %v", err)
		sh.sendError(client, "Invalid signaling message format")
		return
	}

	log.Printf("✅ Parsed signaling message: type=%s, to=%d, from=%d", sigMsg.Type, sigMsg.To, sigMsg.From)

	sigMsg.From = int64(client.UserID)
	sigMsg.Timestamp = time.Now()

	switch sigMsg.Type {
	case MessageTypeCallRequest:
		sh.handleCallRequest(client, &sigMsg)
	case MessageTypeCallAccept:
		sh.handleCallAccept(client, &sigMsg)
	case MessageTypeCallReject:
		sh.handleCallReject(client, &sigMsg)
	case MessageTypeCallEnd:
		sh.handleCallEnd(client, &sigMsg)
	case MessageTypeCallCancel:
		sh.handleCallCancel(client, &sigMsg)
	case MessageTypeOffer:
		sh.handleOffer(client, &sigMsg)
	case MessageTypeAnswer:
		sh.handleAnswer(client, &sigMsg)
	case MessageTypeICECandidate:
		sh.handleICECandidate(client, &sigMsg)
	default:
		log.Printf("❌ Unknown signaling message type: %s", sigMsg.Type)
		sh.sendError(client, "Unknown message type")
	}
}

// handleCallRequest processes a call initiation request
func (sh *SignalingHandler) handleCallRequest(client *chat.Client, msg *SignalingMessage) {
	log.Printf("📞 Processing call request from user %d to user %d (type: %s)", client.UserID, msg.To, msg.CallType)

	// Check if callee exists and is online
	calleeClient := sh.hub.GetClient(msg.To)
	if calleeClient == nil {
		log.Printf("❌ User %d is offline or not found", msg.To)
		sh.sendError(client, "User is offline")
		return
	}

	log.Printf("✅ Found callee client for user %d", msg.To)

	// Create call session
	pc, err := sh.peerManager.CreateCall(int64(client.UserID), msg.To, msg.CallType)
	if err != nil {
		log.Printf("❌ Failed to create call: %v", err)
		if err == ErrUserBusy {
			sh.sendError(client, "User is busy")
		} else {
			sh.sendError(client, "Failed to create call")
		}
		return
	}

	log.Printf("✅ Created call session: %s", pc.CallID)

	// Store call in database
	if err := sh.storeCall(pc); err != nil {
		log.Printf("⚠️ Error storing call: %v", err)
	}

	// Send call request to callee ONLY
	msg.CallID = pc.CallID
	log.Printf("📤 Forwarding call request to callee (user %d) with call_id %s", msg.To, pc.CallID)
	sh.forwardMessage(calleeClient, msg)

	// DO NOT send back to caller - caller already knows they initiated the call!
	log.Printf("✅ Call request sent to callee, caller does not need confirmation")
}

// handleCallAccept processes call acceptance
func (sh *SignalingHandler) handleCallAccept(client *chat.Client, msg *SignalingMessage) {
	pc, exists := sh.peerManager.GetCall(msg.CallID)
	if !exists {
		sh.sendError(client, "Call not found")
		return
	}

	// Verify the client is the callee
	if int64(client.UserID) != pc.CalleeID {
		sh.sendError(client, "Unauthorized")
		return
	}

	// Mark call as accepted
	if err := sh.peerManager.AcceptCall(msg.CallID); err != nil {
		sh.sendError(client, "Failed to accept call")
		return
	}

	// Update call status in database
	if err := sh.updateCallStatus(msg.CallID, CallStatusActive); err != nil {
		log.Printf("Error updating call status: %v", err)
	}

	// Forward acceptance to caller
	callerClient := sh.hub.GetClient(pc.CallerID)
	if callerClient != nil {
		sh.forwardMessage(callerClient, msg)
	}
}

// handleCallReject processes call rejection
func (sh *SignalingHandler) handleCallReject(client *chat.Client, msg *SignalingMessage) {
	pc, err := sh.peerManager.RejectCall(msg.CallID)
	if err != nil {
		sh.sendError(client, "Call not found")
		return
	}

	// Update call status in database
	if err := sh.updateCallStatus(msg.CallID, CallStatusRejected); err != nil {
		log.Printf("Error updating call status: %v", err)
	}

	// Notify caller
	callerClient := sh.hub.GetClient(pc.CallerID)
	if callerClient != nil {
		sh.forwardMessage(callerClient, msg)
	}
}

// handleCallEnd processes call termination
func (sh *SignalingHandler) handleCallEnd(client *chat.Client, msg *SignalingMessage) {
	pc, err := sh.peerManager.EndCall(msg.CallID)
	if err != nil {
		sh.sendError(client, "Call not found")
		return
	}

	// Calculate duration
	duration := int(time.Since(pc.StartedAt).Seconds())

	// Update call in database
	if err := sh.endCall(msg.CallID, duration); err != nil {
		log.Printf("Error ending call: %v", err)
	}

	// Notify the other peer
	otherUserID := pc.CallerID
	if int64(client.UserID) == pc.CallerID {
		otherUserID = pc.CalleeID
	}

	otherClient := sh.hub.GetClient(otherUserID)
	if otherClient != nil {
		sh.forwardMessage(otherClient, msg)
	}
}

// handleCallCancel processes call cancellation (before acceptance)
func (sh *SignalingHandler) handleCallCancel(client *chat.Client, msg *SignalingMessage) {
	pc, err := sh.peerManager.CancelCall(msg.CallID)
	if err != nil {
		sh.sendError(client, "Call not found")
		return
	}

	// Update call status in database
	if err := sh.updateCallStatus(msg.CallID, CallStatusCanceled); err != nil {
		log.Printf("Error updating call status: %v", err)
	}

	// Notify callee
	calleeClient := sh.hub.GetClient(pc.CalleeID)
	if calleeClient != nil {
		sh.forwardMessage(calleeClient, msg)
	}
}

// handleOffer processes SDP offer
func (sh *SignalingHandler) handleOffer(client *chat.Client, msg *SignalingMessage) {
	// Verify call exists
	pc, exists := sh.peerManager.GetCall(msg.CallID)
	if !exists {
		sh.sendError(client, "Call not found")
		return
	}

	// Forward offer to the other peer
	targetClient := sh.hub.GetClient(msg.To)
	if targetClient == nil {
		sh.sendError(client, "Peer is offline")
		return
	}

	log.Printf("Forwarding offer from %d to %d for call %s", client.UserID, msg.To, pc.CallID)
	sh.forwardMessage(targetClient, msg)
}

// handleAnswer processes SDP answer
func (sh *SignalingHandler) handleAnswer(client *chat.Client, msg *SignalingMessage) {
	// Verify call exists
	pc, exists := sh.peerManager.GetCall(msg.CallID)
	if !exists {
		sh.sendError(client, "Call not found")
		return
	}

	// Forward answer to the other peer
	targetClient := sh.hub.GetClient(msg.To)
	if targetClient == nil {
		sh.sendError(client, "Peer is offline")
		return
	}

	log.Printf("Forwarding answer from %d to %d for call %s", client.UserID, msg.To, pc.CallID)
	sh.forwardMessage(targetClient, msg)
}

// handleICECandidate processes ICE candidate
func (sh *SignalingHandler) handleICECandidate(client *chat.Client, msg *SignalingMessage) {
	// Verify call exists
	_, exists := sh.peerManager.GetCall(msg.CallID)
	if !exists {
		sh.sendError(client, "Call not found")
		return
	}

	// Forward ICE candidate to the other peer
	targetClient := sh.hub.GetClient(msg.To)
	if targetClient != nil {
		sh.forwardMessage(targetClient, msg)
	}
}

// Helper functions

func (sh *SignalingHandler) forwardMessage(client *chat.Client, msg *SignalingMessage) {
	// Wrap the signaling message in the expected format: {type: "...", payload: {...}}
	wrapper := map[string]interface{}{
		"type":    msg.Type,
		"payload": msg,
	}

	data, err := json.Marshal(wrapper)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case client.Send <- data:
		log.Printf("Forwarded %s message to user %d", msg.Type, client.UserID)
	default:
		log.Printf("Client %d send channel is full", client.UserID)
	}
}

func (sh *SignalingHandler) sendMessage(client *chat.Client, msg *SignalingMessage) {
	// Wrap the signaling message in the expected format: {type: "...", payload: {...}}
	wrapper := map[string]interface{}{
		"type":    msg.Type,
		"payload": msg,
	}

	data, err := json.Marshal(wrapper)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	select {
	case client.Send <- data:
		log.Printf("Sent %s message to user %d", msg.Type, client.UserID)
	default:
		log.Printf("Client %d send channel is full", client.UserID)
	}
}

func (sh *SignalingHandler) sendError(client *chat.Client, errorMsg string) {
	errResponse := map[string]interface{}{
		"type":  "error",
		"error": errorMsg,
	}

	data, _ := json.Marshal(errResponse)
	select {
	case client.Send <- data:
	default:
		log.Printf("Client %d send channel is full", client.UserID)
	}
}

// Database operations

func (sh *SignalingHandler) storeCall(pc *PeerConnection) error {
	query := `
		INSERT INTO calls (caller_id, callee_id, type, status, started_at)
		VALUES (?, ?, ?, ?, ?)
	`
	_, err := sh.db.DB.Exec(query, pc.CallerID, pc.CalleeID, pc.CallType, pc.Status, pc.StartedAt)
	return err
}

func (sh *SignalingHandler) updateCallStatus(callID string, status CallStatus) error {
	query := `UPDATE calls SET status = ? WHERE id = ?`
	_, err := sh.db.DB.Exec(query, status, callID)
	return err
}

func (sh *SignalingHandler) endCall(callID string, duration int) error {
	query := `
		UPDATE calls 
		SET status = ?, ended_at = ?, duration = ?
		WHERE id = ?
	`
	_, err := sh.db.DB.Exec(query, CallStatusEnded, time.Now(), duration, callID)
	return err
}
