'use client';

import { useEffect, useState } from 'react';
import { logout } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { Search, HelpCircle, LogOut } from 'lucide-react';
import { useAuthContext } from '../Auth/AuthProvider';

interface HeaderProps {
  onShowTutorial?: () => void;
  activeNav?: 'documents' | 'trash' | 'account';
  onNavChange?: (nav: 'documents' | 'trash' | 'account') => void;
}

export default function Header({ onShowTutorial, activeNav = 'documents', onNavChange }: HeaderProps) {
  const { user } = useAuthContext();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const [isMac, setIsMac] = useState(true);

  useEffect(() => {
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const initials = (() => {
    const source = user?.displayName || user?.email || 'You';
    const parts = source.split(/[\s@]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
  })();

  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-sm hairline">
      <div className="max-w-[1440px] mx-auto px-8">
        <div className="flex items-center h-14 gap-8">
          {/* Brand — logo tilts on hover */}
          <div className="flex items-center gap-2.5 mr-2">
            <div className="co-ico co-ico-tilt w-7 h-7 rounded-md bg-accent text-paper-card flex items-center justify-center font-serif text-base leading-none cursor-pointer">
              C
            </div>
            <span className="font-serif text-[17px] text-ink leading-none">Counsel</span>
          </div>

          {/* Nav links */}
          <nav className="flex items-center gap-6">
            {(['documents', 'trash', 'account'] as const).map((id) => (
              <button
                key={id}
                onClick={() => onNavChange?.(id)}
                className="nav-link"
                data-active={activeNav === id}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Search — magnifier wiggles on hover, drifts when search-box itself hovered */}
          <div className="search-box co-search">
            <Search className="co-ico co-ico-wiggle co-ico-search w-3.5 h-3.5 text-ink-faint shrink-0" />
            <input
              type="text"
              placeholder="Search documents"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            <span className="kbd">{isMac ? '⌘K' : '^K'}</span>
          </div>

          {/* Help — wiggle on hover */}
          {onShowTutorial && (
            <button
              onClick={onShowTutorial}
              className="btn btn-ghost btn-sm"
              title="Show tutorial"
            >
              <HelpCircle className="co-ico co-ico-wiggle w-4 h-4" />
            </button>
          )}

          {/* Logout — swing on hover */}
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            title="Sign out"
          >
            <LogOut className="co-ico co-ico-swing w-4 h-4" />
          </button>

          {/* Avatar — rubber squash on hover */}
          {user && (
            <div className="avatar co-ico co-ico-rubber" title={user.displayName || user.email || 'You'}>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
