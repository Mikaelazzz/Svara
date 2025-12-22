package auth

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/yourusername/svara/pkg/response"
)

type Handler struct {
	service *Service
	db      *sql.DB
}

func NewHandler(service *Service) *Handler {
	return &Handler{
		service: service,
		db:      service.db,
	}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	log.Printf("Registration request: %+v", req)

	authResp, err := h.service.Register(req)
	if err != nil {
		log.Printf("Registration error: %v", err)
		response.BadRequest(w, err.Error())
		return
	}

	response.Success(w, "User registered successfully", authResp)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	authResp, err := h.service.Login(req)
	if err != nil {
		response.Unauthorized(w, err.Error())
		return
	}

	// Update user status to online
	_, err = h.db.Exec("UPDATE users SET status = 'online', last_seen = ? WHERE id = ?",
		time.Now().Format(time.RFC3339), authResp.User.ID)
	if err != nil {
		log.Printf("Failed to update user status on login: %v", err)
	}

	response.Success(w, "Login successful", authResp)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	claims, ok := GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	// Update user status to offline and set last_seen
	_, err := h.db.Exec("UPDATE users SET status = 'offline', last_seen = ? WHERE id = ?",
		time.Now().Format(time.RFC3339), claims.UserID)
	if err != nil {
		log.Printf("Failed to update user status on logout: %v", err)
		response.InternalError(w, "Failed to logout")
		return
	}

	log.Printf("User %d logged out", claims.UserID)
	response.Success(w, "Logout successful", nil)
}
