-- Create calls table for storing call history
CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    caller_id INTEGER NOT NULL,
    callee_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('audio', 'video')),
    status TEXT NOT NULL CHECK(status IN ('ringing', 'active', 'ended', 'missed', 'rejected', 'canceled')),
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration INTEGER, -- in seconds
    FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at);
