# Svara Frontend

Frontend aplikasi messaging Svara, dibangun dengan Next.js dan TypeScript.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Setup

1. Install dependencies:
```bash
npm install
```

2. Setup environment variables:
```bash
cp .env.example .env.local
# Edit .env.local dengan konfigurasi Anda
```

3. Run development server:
```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:3000`

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   ├── lib/             # Utilities & API clients
│   ├── hooks/           # Custom React hooks
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript types
│   └── styles/          # Global styles
└── public/              # Static assets
```

## Features

### Phase 1: Core Messaging
- ✅ Authentication (Login/Register)
- ✅ Real-time chat with WebSocket
- ✅ Message status indicators
- ✅ Typing indicators
- ✅ Online/Last seen status

### Phase 2: WebRTC Calls (Future)
- 🔄 1-on-1 voice call
- 🔄 1-on-1 video call

### Phase 3: Advanced (Future)
- 🔄 Group calls
- 🔄 File sharing
- 🔄 End-to-end encryption

## Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```
