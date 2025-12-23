package webrtc

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// PeerConnection represents an active peer connection
type PeerConnection struct {
	CallID    string
	CallerID  int64
	CalleeID  int64
	CallType  CallType
	Status    CallStatus
	StartedAt time.Time
}

// PeerManager manages active peer connections
type PeerManager struct {
	mu          sync.RWMutex
	connections map[string]*PeerConnection // callID -> PeerConnection
	userCalls   map[int64]string           // userID -> callID (one active call per user)
}

// NewPeerManager creates a new peer manager
func NewPeerManager() *PeerManager {
	return &PeerManager{
		connections: make(map[string]*PeerConnection),
		userCalls:   make(map[int64]string),
	}
}

// CreateCall creates a new call session
func (pm *PeerManager) CreateCall(callerID, calleeID int64, callType CallType) (*PeerConnection, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// Check if either user is already in a call
	if _, exists := pm.userCalls[callerID]; exists {
		return nil, ErrUserBusy
	}
	if _, exists := pm.userCalls[calleeID]; exists {
		return nil, ErrUserBusy
	}

	callID := uuid.New().String()
	pc := &PeerConnection{
		CallID:    callID,
		CallerID:  callerID,
		CalleeID:  calleeID,
		CallType:  callType,
		Status:    CallStatusRinging,
		StartedAt: time.Now(),
	}

	pm.connections[callID] = pc
	pm.userCalls[callerID] = callID
	pm.userCalls[calleeID] = callID

	return pc, nil
}

// GetCall retrieves a call by ID
func (pm *PeerManager) GetCall(callID string) (*PeerConnection, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	pc, exists := pm.connections[callID]
	return pc, exists
}

// GetUserCall retrieves the active call for a user
func (pm *PeerManager) GetUserCall(userID int64) (*PeerConnection, bool) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	callID, exists := pm.userCalls[userID]
	if !exists {
		return nil, false
	}

	pc, exists := pm.connections[callID]
	return pc, exists
}

// AcceptCall marks a call as accepted/active
func (pm *PeerManager) AcceptCall(callID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pc, exists := pm.connections[callID]
	if !exists {
		return ErrCallNotFound
	}

	pc.Status = CallStatusActive
	return nil
}

// EndCall removes a call session
func (pm *PeerManager) EndCall(callID string) (*PeerConnection, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pc, exists := pm.connections[callID]
	if !exists {
		return nil, ErrCallNotFound
	}

	pc.Status = CallStatusEnded

	// Remove from tracking
	delete(pm.userCalls, pc.CallerID)
	delete(pm.userCalls, pc.CalleeID)
	delete(pm.connections, callID)

	return pc, nil
}

// RejectCall marks a call as rejected and removes it
func (pm *PeerManager) RejectCall(callID string) (*PeerConnection, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pc, exists := pm.connections[callID]
	if !exists {
		return nil, ErrCallNotFound
	}

	pc.Status = CallStatusRejected

	// Remove from tracking
	delete(pm.userCalls, pc.CallerID)
	delete(pm.userCalls, pc.CalleeID)
	delete(pm.connections, callID)

	return pc, nil
}

// CancelCall marks a call as canceled and removes it
func (pm *PeerManager) CancelCall(callID string) (*PeerConnection, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	pc, exists := pm.connections[callID]
	if !exists {
		return nil, ErrCallNotFound
	}

	pc.Status = CallStatusCanceled

	// Remove from tracking
	delete(pm.userCalls, pc.CallerID)
	delete(pm.userCalls, pc.CalleeID)
	delete(pm.connections, callID)

	return pc, nil
}

// IsUserInCall checks if a user is currently in a call
func (pm *PeerManager) IsUserInCall(userID int64) bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	_, exists := pm.userCalls[userID]
	return exists
}

// Custom errors
var (
	ErrUserBusy     = &PeerError{Message: "user is already in a call"}
	ErrCallNotFound = &PeerError{Message: "call not found"}
)

// PeerError represents a peer-related error
type PeerError struct {
	Message string
}

func (e *PeerError) Error() string {
	return e.Message
}
