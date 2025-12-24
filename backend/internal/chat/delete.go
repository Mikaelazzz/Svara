package chat

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/yourusername/svara/internal/auth"
	"github.com/yourusername/svara/pkg/response"
)

// DeleteConversation marks a conversation as deleted for the current user
// Messages sent before deleted_at will be hidden, new messages will still appear
func (h *Handler) DeleteConversation(w http.ResponseWriter, r *http.Request) {
	claims, ok := auth.GetUserFromContext(r.Context())
	if !ok {
		response.Unauthorized(w, "Unauthorized")
		return
	}

	otherUserIDStr := chi.URLParam(r, "userId")
	otherUserID, err := strconv.Atoi(otherUserIDStr)
	if err != nil {
		response.BadRequest(w, "Invalid user ID")
		return
	}

	log.Printf("User %d deleting conversation with user %d", claims.UserID, otherUserID)

	// Insert or replace record in deleted_conversations table
	// This stores the timestamp of when the user deleted the conversation
	// Messages sent BEFORE this timestamp will be hidden from the user
	// IMPORTANT: Use Go time.Now() to match the format of sent_at in messages table
	result, err := h.db.Exec(
		`INSERT OR REPLACE INTO deleted_conversations (user_id, other_user_id, deleted_at)
		 VALUES (?, ?, ?)`,
		claims.UserID, otherUserID, time.Now(),
	)
	if err != nil {
		log.Printf("Failed to mark conversation as deleted: %v", err)
		response.InternalError(w, "Failed to delete conversation")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Marked conversation as deleted for user %d (rows affected: %d)", claims.UserID, rowsAffected)

	response.Success(w, "Conversation deleted successfully", nil)
}
