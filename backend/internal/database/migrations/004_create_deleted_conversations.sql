-- Migration: Create deleted_conversations table
-- This table tracks when a user deleted their view of a conversation
-- Messages sent AFTER deleted_at will still be visible to the user

CREATE TABLE IF NOT EXISTS deleted_conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    other_user_id INTEGER NOT NULL,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, other_user_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (other_user_id) REFERENCES users(id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_deleted_conversations_user ON deleted_conversations(user_id, other_user_id);
