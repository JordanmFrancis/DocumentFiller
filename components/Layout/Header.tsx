'use client';

import { motion } from 'framer-motion';
import { logout } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { LogOut, User, HelpCircle } from 'lucide-react';
import { useAuthContext } from '../Auth/AuthProvider';

interface HeaderProps {
  onShowTutorial?: () => void;
}

export default function Header({ onShowTutorial }: HeaderProps) {
  const { user } = useAuthContext();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-xl border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <h1 className="text-xl font-bold text-white">Document Filler</h1>
          </motion.div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="text-gray-300 text-sm hidden sm:block">
                  {user.displayName || user.email}
                </span>
              </div>
            )}
            {onShowTutorial && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onShowTutorial}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Show Tutorial"
              >
                <HelpCircle className="w-5 h-5 text-gray-400 hover:text-white" />
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-gray-400 hover:text-white" />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}
