export interface User {
  id: number;
  phone?: string;
  email?: string;
  name: string;
  avatar_url?: string;
  status: 'online' | 'offline';
  last_seen?: string;
  created_at: string;
}

export interface RegisterRequest {
  phone?: string;
  email?: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  phone?: string;
  email?: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}
