# WebSocket Protocol Documentation

WebSocket endpoint: `ws://localhost:8080/ws/chat`

## Connection

### Authentication
WebSocket connection requires JWT authentication via query parameter or header:

**Via Header (Recommended):**
```
Authorization: Bearer <access_token>
```

**Via Query Parameter:**
```
ws://localhost:8080/ws/chat?token=<access_token>
```

### Connection Flow
1. Client connects to WebSocket endpoint with JWT token
2. Server validates token and registers client
3. Server broadcasts user's online status to other users
4. Client can now send/receive messages

---

## Message Format

All WebSocket messages follow this JSON format:

```json
{
  "type": "message_type",
  "payload": { /* type-specific data */ }
}
```

---

## Message Types

### 1. Chat Message

**Client → Server**
```json
{
  "type": "message",
  "payload": {
    "receiver_id": 2,
    "content": "Hello, how are you?"
  }
}
```

**Server → Sender (Confirmation)**
```json
{
  "type": "message_sent",
  "payload": {
    "id": 123,
    "sender_id": 1,
    "receiver_id": 2,
    "content": "Hello, how are you?",
    "sent_at": "2024-01-01T12:00:00Z"
  }
}
```

**Server → Receiver**
```json
{
  "type": "message",
  "payload": {
    "id": 123,
    "sender_id": 1,
    "receiver_id": 2,
    "content": "Hello, how are you?",
    "sent_at": "2024-01-01T12:00:00Z",
    "delivered_at": "2024-01-01T12:00:01Z"
  }
}
```

---

### 2. Typing Indicator

**Client → Server**
```json
{
  "type": "typing",
  "payload": {
    "receiver_id": 2,
    "is_typing": true
  }
}
```

**Server → Receiver**
```json
{
  "type": "typing",
  "payload": {
    "user_id": 1,
    "is_typing": true
  }
}
```

**Notes:**
- Send `is_typing: true` when user starts typing
- Send `is_typing: false` when user stops typing
- Typing indicator should auto-clear after 3-5 seconds

---

### 3. Message Receipt

**Client → Server**
```json
{
  "type": "receipt",
  "payload": {
    "message_id": 123,
    "status": "read"  // or "delivered"
  }
}
```

**Server → Original Sender**
```json
{
  "type": "receipt",
  "payload": {
    "message_id": 123,
    "status": "read"
  }
}
```

**Receipt Statuses:**
- `delivered` - Message received on device (✓✓)
- `read` - Message opened/read (✓✓ blue)

---

### 4. User Status

**Server → All Connected Clients** (when user goes online/offline)
```json
{
  "type": "user_status",
  "payload": {
    "user_id": 3,
    "status": "online",  // or "offline"
    "last_seen": "2024-01-01T12:00:00Z"
  }
}
```

---

## Connection Lifecycle

### 1. Connect
```javascript
const ws = new WebSocket('ws://localhost:8080/ws/chat');
ws.onopen = () => {
  console.log('Connected to chat server');
};
```

### 2. Send Message
```javascript
ws.send(JSON.stringify({
  type: 'message',
  payload: {
    receiver_id: 2,
    content: 'Hello!'
  }
}));
```

### 3. Receive Messages
```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'message':
      // Handle incoming message
      displayMessage(data.payload);
      
      // Send delivery receipt
      ws.send(JSON.stringify({
        type: 'receipt',
        payload: {
          message_id: data.payload.id,
          status: 'delivered'
        }
      }));
      break;
      
    case 'typing':
      // Show typing indicator
      showTypingIndicator(data.payload.user_id);
      break;
      
    case 'receipt':
      // Update message status
      updateMessageStatus(data.payload.message_id, data.payload.status);
      break;
      
    case 'user_status':
      // Update user online status
      updateUserStatus(data.payload.user_id, data.payload.status);
      break;
  }
};
```

### 4. Disconnect
```javascript
ws.onclose = () => {
  console.log('Disconnected from chat server');
  // Attempt reconnection
};
```

---

## Error Handling

### Connection Errors
```javascript
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### Reconnection Strategy
```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connect() {
  const ws = new WebSocket('ws://localhost:8080/ws/chat');
  
  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      setTimeout(connect, 1000 * reconnectAttempts);
    }
  };
  
  ws.onopen = () => {
    reconnectAttempts = 0;
  };
}
```

---

## Best Practices

### 1. Heartbeat/Ping-Pong
The server automatically sends ping frames every 54 seconds. Client should respond with pong frames (handled automatically by browser WebSocket API).

### 2. Message Queuing
Queue messages when connection is lost and resend when reconnected.

### 3. Typing Indicators
- Debounce typing events (send max once per second)
- Auto-clear after 3-5 seconds of inactivity

### 4. Read Receipts
- Send "delivered" receipt immediately when message arrives
- Send "read" receipt when user views the message

### 5. Token Refresh
If token expires during WebSocket connection:
1. Server will close the connection
2. Client should refresh token
3. Reconnect with new token

---

## Example: Complete Chat Flow

```
User A                    Server                    User B
  |                         |                         |
  |--- Connect (JWT) -----→ |                         |
  |                         |--- Register Client      |
  |                         |--- Broadcast Online -→  |
  |                         |                         |
  |--- Send Message ------→ |                         |
  |                         |--- Save to DB           |
  |← Message Sent (✓) ----- |                         |
  |                         |--- Forward Message --→  |
  |                         |                         |
  |                         | ←-- Delivered Receipt --|
  |← Delivered (✓✓) ------- |                         |
  |                         |                         |
  |                         | ←-- Read Receipt -------|
  |← Read (✓✓ blue) ------- |                         |
  |                         |                         |
```

---

## REST API Endpoints (Complementary)

### Get Message History
```
GET /api/chat/messages?user_id=2
Authorization: Bearer <token>
```

Returns last 50 messages between authenticated user and specified user.

### Get Conversations
```
GET /api/chat/conversations
Authorization: Bearer <token>
```

Returns list of all conversations with last message and unread count.
