package webrtc

import "time"

// SignalingMessageType defines the type of signaling message
type SignalingMessageType string

const (
	// Call management messages
	MessageTypeCallRequest SignalingMessageType = "call-request"
	MessageTypeCallAccept  SignalingMessageType = "call-accept"
	MessageTypeCallReject  SignalingMessageType = "call-reject"
	MessageTypeCallEnd     SignalingMessageType = "call-end"
	MessageTypeCallCancel  SignalingMessageType = "call-cancel"

	// WebRTC signaling messages
	MessageTypeOffer        SignalingMessageType = "offer"
	MessageTypeAnswer       SignalingMessageType = "answer"
	MessageTypeICECandidate SignalingMessageType = "ice-candidate"
)

// CallType defines the type of call
type CallType string

const (
	CallTypeAudio CallType = "audio"
	CallTypeVideo CallType = "video"
)

// CallStatus defines the status of a call
type CallStatus string

const (
	CallStatusRinging CallStatus = "ringing"
	CallStatusActive  CallStatus = "active"
	CallStatusEnded   CallStatus = "ended"
	CallStatusMissed  CallStatus = "missed"
	CallStatusRejected CallStatus = "rejected"
	CallStatusCanceled CallStatus = "canceled"
)

// SignalingMessage represents a WebRTC signaling message
type SignalingMessage struct {
	Type      SignalingMessageType `json:"type"`
	From      int64                `json:"from"`
	To        int64                `json:"to"`
	CallID    string               `json:"call_id,omitempty"`
	CallType  CallType             `json:"call_type,omitempty"`
	SDP       string               `json:"sdp,omitempty"`
	Candidate *ICECandidate        `json:"candidate,omitempty"`
	Timestamp time.Time            `json:"timestamp"`
}

// ICECandidate represents an ICE candidate
type ICECandidate struct {
	Candidate     string `json:"candidate"`
	SDPMid        string `json:"sdpMid"`
	SDPMLineIndex int    `json:"sdpMLineIndex"`
}

// CallRequest represents a call initiation request
type CallRequest struct {
	CalleeID int64    `json:"callee_id"`
	CallType CallType `json:"call_type"`
}

// CallResponse represents a response to a call request
type CallResponse struct {
	CallID   string     `json:"call_id"`
	CallerID int64      `json:"caller_id"`
	CalleeID int64      `json:"callee_id"`
	CallType CallType   `json:"call_type"`
	Status   CallStatus `json:"status"`
}

// Call represents a call record in the database
type Call struct {
	ID        int64      `json:"id"`
	CallerID  int64      `json:"caller_id"`
	CalleeID  int64      `json:"callee_id"`
	Type      CallType   `json:"type"`
	Status    CallStatus `json:"status"`
	StartedAt time.Time  `json:"started_at"`
	EndedAt   *time.Time `json:"ended_at,omitempty"`
	Duration  *int       `json:"duration,omitempty"` // in seconds
}
