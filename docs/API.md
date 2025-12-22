# Svara API Documentation

Base URL: `http://localhost:8080/api`

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## Endpoints

### Health Check

**GET** `/health`

Check if server is running.

**Response:**
```
OK
```

---

### Register

**POST** `/auth/register`

Register a new user with phone or email.

**Request Body:**
```json
{
  "phone": "+628123456789",  // Optional (phone OR email required)
  "email": "user@example.com", // Optional (phone OR email required)
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "phone": "+628123456789",
      "email": "user@example.com",
      "name": "John Doe",
      "status": "offline",
      "created_at": "2024-01-01T00:00:00Z"
    },
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc..."
  }
}
```

**Errors:**
- `400 Bad Request` - Invalid input or user already exists
- `500 Internal Server Error` - Server error

---

### Login

**POST** `/auth/login`

Login with phone or email.

**Request Body:**
```json
{
  "phone": "+628123456789",  // Optional (phone OR email required)
  "email": "user@example.com", // Optional (phone OR email required)
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "phone": "+628123456789",
      "name": "John Doe",
      "status": "offline",
      "last_seen": "2024-01-01T00:00:00Z"
    },
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc..."
  }
}
```

**Errors:**
- `401 Unauthorized` - Invalid credentials
- `400 Bad Request` - Invalid input

---

## Protected Endpoints

All endpoints below require authentication.

### Get User Profile

**GET** `/users/me`

Get current user profile.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": 1,
    "phone": "+628123456789",
    "name": "John Doe",
    "avatar_url": "https://...",
    "status": "online",
    "last_seen": "2024-01-01T00:00:00Z"
  }
}
```

---

### Update User Profile

**PUT** `/users/me`

Update current user profile.

**Request Body:**
```json
{
  "name": "John Updated",
  "avatar_url": "https://..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Profile updated successfully"
}
```

---

## WebSocket Endpoints

See [WEBSOCKET.md](./WEBSOCKET.md) for WebSocket protocol documentation.

- `WS /ws/chat` - Real-time chat
- `WS /ws/webrtc` - WebRTC signaling

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

- `200 OK` - Request successful
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error
