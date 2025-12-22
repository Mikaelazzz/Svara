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

export interface UserProfile extends User {
  // Additional profile fields can be added here
}
