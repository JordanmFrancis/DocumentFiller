'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import LoginForm from '@/components/Auth/LoginForm';

export default function LoginPage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-ink border-t-transparent mx-auto mb-4"></div>
          <p className="font-marker text-ink text-lg">Loading…</p>
          <p className="font-cursive text-sm text-ink-soft mt-2">
            if this takes too long, check the browser console
          </p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <LoginForm />;
}
