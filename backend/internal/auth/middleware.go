package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/yourusername/svara/internal/config"
	"github.com/yourusername/svara/pkg/response"
	"github.com/yourusername/svara/pkg/utils"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try to get token from Authorization header first
			authHeader := r.Header.Get("Authorization")
			tokenString := ""

			if authHeader != "" {
				// Extract token from "Bearer <token>"
				parts := strings.Split(authHeader, " ")
				if len(parts) == 2 && parts[0] == "Bearer" {
					tokenString = parts[1]
				}
			} else {
				// If no Authorization header, try query parameter (for WebSocket)
				tokenString = r.URL.Query().Get("token")
			}

			if tokenString == "" {
				response.Unauthorized(w, "Missing authorization token")
				return
			}

			claims, err := utils.ValidateToken(tokenString, cfg.JWTSecret)
			if err != nil {
				response.Unauthorized(w, "Invalid or expired token")
				return
			}

			// Add claims to context
			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserFromContext(ctx context.Context) (*utils.Claims, bool) {
	claims, ok := ctx.Value(UserContextKey).(*utils.Claims)
	return claims, ok
}
