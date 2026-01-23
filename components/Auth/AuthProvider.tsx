'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    try {
      // Check if Firebase is properly configured
      if (!auth || !auth.app) {
        console.error('Firebase auth not initialized');
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          if (mounted) {
            setUser(user);
            setLoading(false);
          }
        },
        (error) => {
          console.error('Auth state error:', error);
          if (mounted) {
            setLoading(false);
          }
        }
      );

      // Timeout fallback - if auth doesn't respond in 3 seconds, stop loading
      const timeout = setTimeout(() => {
        if (mounted) {
          console.warn('Auth initialization timeout');
          setLoading(false);
        }
      }, 3000);

      return () => {
        mounted = false;
        unsubscribe();
        clearTimeout(timeout);
      };
    } catch (error) {
      console.error('Firebase auth initialization error:', error);
      if (mounted) {
        setLoading(false);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
