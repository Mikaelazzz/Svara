'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    // Wait for auth to initialize before redirecting
    if (!isInitialized) return;

    if (isAuthenticated) {
      router.push('/chat');
    } else {
      router.push('/login');
    }
  }, [isAuthenticated, isInitialized, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="text-white text-2xl font-bold">Loading...</div>
    </div>
  );
}
