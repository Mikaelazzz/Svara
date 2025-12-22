# Svara - Real-time Messaging Application

Svara adalah aplikasi messaging real-time dengan fitur chat, voice/video call menggunakan WebRTC, dibangun dengan Go (backend) dan Next.js (frontend).

## 🚀 Features

### Phase 1: Core Messaging (MVP) ✅
- ✅ Authentication dengan JWT (Phone/Email)
- ✅ Real-time text chat dengan WebSocket
- ✅ Status indicators (Online, Typing, Last Seen)
- ✅ Message receipts (Sent ✓, Delivered ✓✓, Read ✓✓)

### Phase 2: Audio & Video Call (In Progress)
- 🔄 1-on-1 Voice Call (WebRTC)
- 🔄 1-on-1 Video Call (WebRTC)
- 🔄 Peer-to-Peer connection

### Phase 3: Advanced Features (Planned)
- 📋 Group Call dengan SFU
- 📋 File Sharing via WebRTC Data Channels
- 📋 End-to-End Encryption (E2EE)

## 📁 Project Structure

```
svara/
├── backend/          # Go backend server
│   ├── cmd/         # Application entry points
│   ├── internal/    # Private application code
│   │   ├── auth/   # Authentication
│   │   ├── chat/   # WebSocket chat
│   │   ├── webrtc/ # WebRTC signaling
│   │   ├── user/   # User management
│   │   ├── database/ # Database layer
│   │   └── config/ # Configuration
│   └── pkg/        # Public libraries
│
├── frontend/        # Next.js frontend
│   └── src/
│       ├── app/    # Next.js App Router
│       ├── components/ # React components
│       ├── lib/    # Utilities & API clients
│       ├── hooks/  # Custom hooks
│       ├── store/  # State management
│       └── types/  # TypeScript types
│
└── docs/           # Documentation
```

## 🛠️ Tech Stack

### Backend
- **Language**: Go 1.21+
- **Router**: Chi
- **WebSocket**: gorilla/websocket
- **WebRTC**: pion/webrtc
- **Database**: SQLite
- **Authentication**: JWT

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **WebSocket**: Native WebSocket API
- **WebRTC**: Native WebRTC API

## 🚀 Quick Start

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
go mod download
```

3. Setup environment:
```bash
cp .env.example .env
# Edit .env file
```

4. Run migrations:
```bash
go run cmd/server/main.go migrate
```

5. Start server:
```bash
go run cmd/server/main.go
```

Server akan berjalan di `http://localhost:8080`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment:
```bash
cp .env.example .env.local
# Edit .env.local file
```

4. Start development server:
```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

## 📖 Documentation

Lihat folder `docs/` untuk dokumentasi lengkap:
- [API Documentation](docs/API.md)
- [WebSocket Protocol](docs/WEBSOCKET.md)
- [WebRTC Signaling](docs/WEBRTC.md)
- [Database Schema](docs/DATABASE.md)
- [Architecture](docs/ARCHITECTURE.md)

## 🗄️ Database Schema

### Users
- User authentication (phone/email)
- Profile information
- Online status tracking

### Messages
- Message content
- Delivery & read receipts
- Encryption support

### Calls
- Call history
- Call type (audio/video)
- Call duration tracking

## 🔐 Environment Variables

### Backend (.env)
```
PORT=8080
JWT_SECRET=your-secret-key
DATABASE_PATH=./svara.db
ALLOWED_ORIGINS=http://localhost:3000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

## 📝 Development Roadmap

- [x] Project planning & architecture
- [x] Backend structure setup
- [x] Frontend structure setup
- [x] Database schema design
- [x] JWT authentication system
- [ ] WebSocket chat implementation
- [ ] WebRTC signaling server
- [ ] Frontend chat UI
- [ ] Voice/Video call UI
- [ ] Group call with SFU
- [ ] File sharing
- [ ] E2EE implementation

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📄 License

MIT License - see LICENSE file for details

## 👥 Authors

Your Name - Initial work

## 🙏 Acknowledgments

- Pion WebRTC team
- Go Chi router
- Next.js team
