'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    // Initialize auth from localStorage on mount
    initializeAuth();

    // Update activity timestamp on user interaction
    const updateActivity = () => {
      if (typeof window !== 'undefined') {
        const isAuthenticated = useAuthStore.getState().isAuthenticated;
        if (isAuthenticated) {
          localStorage.setItem('auth_timestamp', Date.now().toString());
        }
      }
    };

    // Listen to user activity
    window.addEventListener('click', updateActivity);
    window.addEventListener('keypress', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keypress', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [initializeAuth]);

  return <>{children}</>;
}
