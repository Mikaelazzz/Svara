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
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				response.Unauthorized(w, "Missing authorization header")
				return
			}

			// Extract token from "Bearer <token>"
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				response.Unauthorized(w, "Invalid authorization header format")
				return
			}

			token := parts[1]
			claims, err := utils.ValidateToken(token, cfg.JWTSecret)
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
