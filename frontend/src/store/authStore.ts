import { create } from 'zustand';
import type { User } from '@/types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken, refreshToken) => {
    // Save to localStorage
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));

    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },

  clearAuth: () => {
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  updateUser: (updates) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    }));
  },
}));

// Initialize from localStorage on app start
if (typeof window !== 'undefined') {
  const accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');
  const userStr = localStorage.getItem('user');

  if (accessToken && refreshToken && userStr) {
    try {
      const user = JSON.parse(userStr);
      useAuthStore.setState({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Failed to parse user from localStorage');
    }
  }
}
