package chat

import (
	"log"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/yourusername/svara/internal/auth"
	"github.com/yourusername/svara/pkg/response"
)

// DeleteConversation marks messages as deleted for the current user only
// The other user will still see their messages
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

	// Mark messages as deleted for current user only
	result, err := h.db.Exec(
		`UPDATE messages 
		 SET deleted_for_user_id = ?
		 WHERE deleted_for_user_id IS NULL 
		 AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`,
		claims.UserID, claims.UserID, otherUserID, otherUserID, claims.UserID,
	)
	if err != nil {
		log.Printf("Failed to mark conversation as deleted: %v", err)
		response.InternalError(w, "Failed to delete conversation")
		return
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("Marked %d messages as deleted for user %d", rowsAffected, claims.UserID)

	response.Success(w, "Conversation deleted successfully", nil)
}
