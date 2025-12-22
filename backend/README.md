# Svara Backend

Backend server untuk aplikasi messaging Svara, dibangun dengan Go.

## Tech Stack
- **Language**: Go 1.21+
- **Router**: Chi
- **WebSocket**: gorilla/websocket
- **WebRTC**: pion/webrtc
- **Database**: SQLite
- **Authentication**: JWT (golang-jwt)

## Setup

1. Install dependencies:
```bash
go mod download
```

2. Setup environment variables:
```bash
cp .env.example .env
# Edit .env dengan konfigurasi Anda
```

3. Run migrations:
```bash
go run cmd/server/main.go migrate
```

4. Start server:
```bash
go run cmd/server/main.go
```

Server akan berjalan di `http://localhost:8080`

## Project Structure

```
backend/
├── cmd/server/          # Entry point
├── internal/            # Private application code
│   ├── auth/           # Authentication
│   ├── chat/           # WebSocket chat
│   ├── webrtc/         # WebRTC signaling
│   ├── user/           # User management
│   ├── database/       # Database layer
│   └── config/         # Configuration
└── pkg/                # Public libraries
    ├── utils/          # Utilities
    └── response/       # API responses
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh token

### Chat
- `WS /ws/chat` - WebSocket connection for chat

### WebRTC
- `WS /ws/webrtc` - WebSocket connection for signaling

## Environment Variables

```
PORT=8080
JWT_SECRET=your-secret-key
DATABASE_PATH=./svara.db
```
