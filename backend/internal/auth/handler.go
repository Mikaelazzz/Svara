package auth

import (
	"encoding/json"
	"net/http"

	"github.com/yourusername/svara/pkg/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	authResp, err := h.service.Register(req)
	if err != nil {
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

	response.Success(w, "Login successful", authResp)
}
