'use client';

import { motion } from 'framer-motion';
import { logout } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { LogOut, User, HelpCircle, FileText } from 'lucide-react';
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
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-sm border-b-2 border-ink">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-md border-[1.5px] border-ink bg-accent-yellow flex items-center justify-center shadow-rough rotate-tiny-l">
                <FileText className="w-5 h-5 text-ink" strokeWidth={2.25} />
              </div>
            </div>
            <div className="relative">
              <h1 className="font-marker text-2xl text-ink leading-none squig">
                Document Filler
              </h1>
              <span className="font-cursive text-sm text-ink-soft block mt-1">
                a paper form, but on screen
              </span>
            </div>
          </motion.div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex items-center gap-2 pill-hand">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-6 h-6 rounded-full border-[1.5px] border-ink"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full border-[1.5px] border-ink bg-accent-mint flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-ink" />
                  </div>
                )}
                <span className="text-ink text-sm font-marker">
                  {user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'You'}
                </span>
              </div>
            )}
            {onShowTutorial && (
              <motion.button
                whileHover={{ scale: 1.05, rotate: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={onShowTutorial}
                className="btn-rough"
                title="Show tutorial"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden md:inline">Help</span>
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05, rotate: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="btn-rough"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Sign out</span>
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
}
