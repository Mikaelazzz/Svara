package auth

import "time"

type User struct {
	ID           int        `json:"id"`
	Phone        *string    `json:"phone,omitempty"`
	Email        *string    `json:"email,omitempty"`
	PasswordHash string     `json:"-"`
	Name         string     `json:"name"`
	AvatarURL    *string    `json:"avatar_url,omitempty"`
	Status       string     `json:"status"`
	LastSeen     *time.Time `json:"last_seen,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
}

type RegisterRequest struct {
	Phone    *string `json:"phone,omitempty"`
	Email    *string `json:"email,omitempty"`
	Password string  `json:"password"`
	Name     string  `json:"name"`
}

type LoginRequest struct {
	Phone    *string `json:"phone,omitempty"`
	Email    *string `json:"email,omitempty"`
	Password string  `json:"password"`
}

type AuthResponse struct {
	User         User   `json:"user"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}
