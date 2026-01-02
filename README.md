# Svara - Aplikasi Messaging Real-time

**Svara** adalah platform komunikasi real-time yang mendukung pesan teks dan panggilan suara. Proyek ini dibangun menggunakan **Go** pada sisi *backend* dan **Next.js** pada sisi *frontend* dengan fokus pada performa dan skalabilitas.

## 🚀 Fitur Utama

### ✅ Messaging Utama

* **Autentikasi Aman**: Registrasi dan login pengguna menggunakan JWT (Phone/Email).
* **Chat Real-time**: Komunikasi teks instan yang dibangun di atas protokol WebSocket.
* **Indikator Status**: Fitur untuk melihat status Online, sedang mengetik (*Typing*), serta informasi *Last Seen*.
* **Laporan Pesan**: Indikator status pesan yang lengkap mulai dari Terkirim (✓), Sampai (✓✓), hingga Dibaca (✓✓ biru).

### ✅ Panggilan Audio

* **Panggilan Suara 1-on-1**: Komunikasi suara berkualitas tinggi menggunakan teknologi WebRTC.
* **Koneksi Peer-to-Peer**: Memungkinkan sambungan langsung antar pengguna untuk memastikan latensi yang sangat rendah.

## 🛠️ Tech Stack

### Backend

* **Bahasa**: Go 1.21+
* **Router**: Chi v5
* **WebSocket**: Gorilla WebSocket
* **WebRTC**: Pion WebRTC
* **Database**: SQLite
* **Autentikasi**: JWT (golang-jwt)

### Frontend

* **Framework**: Next.js 14/15 (App Router)
* **Bahasa**: TypeScript
* **Styling**: TailwindCSS
* **State Management**: Zustand
* **HTTP Client**: Axios

## 📁 Struktur Proyek

```text
svara/
├── backend/          # Server Go
│   ├── cmd/          # Entry point aplikasi (server & migrasi)
│   ├── internal/     # Kode aplikasi privat (auth, chat, webrtc, database)
│   └── pkg/          # Library publik dan utilitas sistem
├── frontend/         # Aplikasi Next.js
│   ├── src/app/      # Next.js App Router (Halaman & Layout)
│   ├── src/components/ # Komponen UI React (Chat & Panggilan)
│   └── src/store/    # State management menggunakan Zustand

```

## ⚙️ Persiapan dan Instalasi

### 1. Persiapan Backend

Masuk ke direktori backend:

```bash
cd backend

```

Instal dependensi:

```bash
go mod download

```

Konfigurasi environment:

```bash
cp .env.example .env
# Sesuaikan JWT_SECRET dan DATABASE_PATH di file .env

```

Jalankan migrasi dan mulai server:

```bash
go run cmd/server/main.go migrate
go run cmd/server/main.go

```

*Server akan berjalan di `http://localhost:8080*`.

### 2. Persiapan Frontend

Masuk ke direktori frontend:

```bash
cd frontend

```

Instal dependensi:

```bash
npm install

```

Konfigurasi environment:

```bash
cp .env.example .env.local
# Sesuaikan NEXT_PUBLIC_API_URL ke alamat backend

```

Jalankan server pengembangan:

```bash
npm run dev

```

*Aplikasi akan berjalan di `http://localhost:3000*`.

## 🔌 Endpoints API Utama

### Autentikasi

* `POST /api/auth/register`: Pendaftaran pengguna baru.
* `POST /api/auth/login`: Masuk untuk mendapatkan token akses JWT.

### Komunikasi Real-time

* `WS /ws/chat`: Koneksi WebSocket untuk pertukaran pesan chat.
* `WS /ws/webrtc`: Koneksi WebSocket untuk signaling panggilan audio.
