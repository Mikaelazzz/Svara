import { create } from 'zustand';
import type { User } from '@/types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  initializeAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isInitialized: false,

  setAuth: (user, accessToken, refreshToken) => {
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('auth_timestamp', Date.now().toString());
    }

    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    });
  },

  clearAuth: () => {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('auth_timestamp');
    }

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  updateUser: (updates) => {
    set((state) => {
      const updatedUser = state.user ? { ...state.user, ...updates } : null;
      
      // Update localStorage
      if (typeof window !== 'undefined' && updatedUser) {
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      
      return { user: updatedUser };
    });
  },

  initializeAuth: () => {
    if (typeof window === 'undefined') {
      set({ isInitialized: true });
      return;
    }

    const accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userStr = localStorage.getItem('user');
    const authTimestamp = localStorage.getItem('auth_timestamp');

    console.log('Initializing auth:', { 
      hasToken: !!accessToken, 
      hasRefresh: !!refreshToken, 
      hasUser: !!userStr 
    });

    // Check if session is expired (24 hours)
    if (authTimestamp) {
      const timestamp = parseInt(authTimestamp);
      const now = Date.now();
      const hoursPassed = (now - timestamp) / (1000 * 60 * 60);
      
      if (hoursPassed > 24) {
        console.log('Session expired, clearing auth');
        // Session expired, clear auth
        useAuthStore.getState().clearAuth();
        set({ isInitialized: true });
        return;
      }
    }

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr);
        console.log('Restoring session for user:', user.name);
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isInitialized: true,
        });
      } catch (error) {
        console.error('Failed to parse user from localStorage');
        useAuthStore.getState().clearAuth();
        set({ isInitialized: true });
      }
    } else {
      set({ isInitialized: true });
    }
  },
}));
