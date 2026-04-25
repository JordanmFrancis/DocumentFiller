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
          <div className="animate-spin rounded-full h-9 w-9 border-2 border-accent border-t-transparent mx-auto mb-3"></div>
          <p className="text-ink-soft text-[14px]">Loading…</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return <LoginForm />;
}
