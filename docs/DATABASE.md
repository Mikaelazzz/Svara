# Database Schema

Svara menggunakan SQLite sebagai database dengan schema berikut:

## Tables

### users

Menyimpan informasi user dan authentication.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone VARCHAR(20) UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    avatar_url TEXT,
    status VARCHAR(50) DEFAULT 'offline',
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (phone IS NOT NULL OR email IS NOT NULL)
);
```

**Columns:**
- `id`: Primary key
- `phone`: Nomor telepon (unique, optional)
- `email`: Email address (unique, optional)
- `password_hash`: Bcrypt hashed password
- `name`: Display name
- `avatar_url`: URL to avatar image
- `status`: Online status ('online' | 'offline')
- `last_seen`: Last activity timestamp
- `created_at`: Account creation timestamp

**Indexes:**
- `idx_users_phone` on `phone`
- `idx_users_email` on `email`
- `idx_users_status` on `status`

---

### messages

Menyimpan pesan chat dengan delivery receipts.

```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT 0,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Columns:**
- `id`: Primary key
- `sender_id`: User ID yang mengirim
- `receiver_id`: User ID yang menerima
- `content`: Isi pesan (encrypted jika E2EE enabled)
- `encrypted`: Flag untuk E2EE
- `sent_at`: Waktu pesan dikirim
- `delivered_at`: Waktu pesan diterima di device penerima
- `read_at`: Waktu pesan dibaca

**Indexes:**
- `idx_messages_sender` on `sender_id`
- `idx_messages_receiver` on `receiver_id`
- `idx_messages_conversation` on `(sender_id, receiver_id)`
- `idx_messages_sent_at` on `sent_at`

**Message Status:**
- Sent (✓): `sent_at` is set
- Delivered (✓✓): `delivered_at` is set
- Read (✓✓ blue): `read_at` is set

---

### calls

Menyimpan history panggilan audio/video.

```sql
CREATE TABLE calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caller_id INTEGER NOT NULL,
    callee_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('audio', 'video')),
    status VARCHAR(20) NOT NULL DEFAULT 'ringing' 
        CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'rejected')),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration INTEGER,
    FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Columns:**
- `id`: Primary key
- `caller_id`: User ID yang menelpon
- `callee_id`: User ID yang ditelpon
- `type`: Tipe panggilan ('audio' | 'video')
- `status`: Status panggilan
  - `ringing`: Sedang berdering
  - `active`: Panggilan aktif
  - `ended`: Panggilan selesai
  - `missed`: Tidak dijawab
  - `rejected`: Ditolak
- `started_at`: Waktu panggilan dimulai
- `ended_at`: Waktu panggilan berakhir
- `duration`: Durasi panggilan (dalam detik)

**Indexes:**
- `idx_calls_caller` on `caller_id`
- `idx_calls_callee` on `callee_id`
- `idx_calls_started_at` on `started_at`
- `idx_calls_status` on `status`

---

## Relationships

```
users (1) ----< (N) messages (sender)
users (1) ----< (N) messages (receiver)
users (1) ----< (N) calls (caller)
users (1) ----< (N) calls (callee)
```

---

## Queries Examples

### Get conversation between two users

```sql
SELECT * FROM messages 
WHERE (sender_id = ? AND receiver_id = ?) 
   OR (sender_id = ? AND receiver_id = ?)
ORDER BY sent_at DESC
LIMIT 50;
```

### Get unread message count

```sql
SELECT COUNT(*) FROM messages
WHERE receiver_id = ? AND read_at IS NULL;
```

### Get user's call history

```sql
SELECT * FROM calls
WHERE caller_id = ? OR callee_id = ?
ORDER BY started_at DESC
LIMIT 20;
```

### Update message as delivered

```sql
UPDATE messages 
SET delivered_at = CURRENT_TIMESTAMP
WHERE id = ? AND delivered_at IS NULL;
```

### Update message as read

```sql
UPDATE messages 
SET read_at = CURRENT_TIMESTAMP
WHERE id = ? AND read_at IS NULL;
```

---

## Migration Files

Migrations are located in `backend/internal/database/migrations/`:

1. `001_create_users.sql` - Creates users table
2. `002_create_messages.sql` - Creates messages table
3. `003_create_calls.sql` - Creates calls table

To run migrations:
```bash
go run cmd/server/main.go migrate
```
