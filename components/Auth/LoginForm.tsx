'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } from '@/lib/firebase/auth';
import { Mail, Lock, LogIn, FileText } from 'lucide-react';

export default function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signInWithApple();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      setError(err.message || `Failed to ${isSignUp ? 'sign up' : 'sign in'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper p-4 relative overflow-hidden">
      {/* Decorative paper backdrop */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(135deg, rgba(0,0,0,.04) 0 4px, transparent 4px 14px)`,
        }}
      />

      {/* Floating sticky notes */}
      <div className="hidden lg:block absolute top-12 left-12 sticky-note rotate-small-l w-52">
        <span className="text-base">welcome back!<br />sign in to keep going ✨</span>
      </div>
      <div className="hidden lg:block absolute bottom-16 right-12 sticky-note rotate-small-r w-48" style={{ background: '#ffe0e0' }}>
        <span className="text-base">first time here?<br />click "Sign up" below</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="card-paper p-8 relative">
          {/* Tape on top */}
          <div className="tape" style={{ top: '-12px', left: '50%', marginLeft: '-35px' }} />

          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-md border-[1.5px] border-ink bg-accent-yellow shadow-rough rotate-tiny-l mb-4">
              <FileText className="w-8 h-8 text-ink" strokeWidth={2} />
            </div>
            <h1 className="font-marker text-3xl text-ink mb-1">Document Filler</h1>
            <p className="font-cursive text-lg text-ink-soft">
              sign in to fill some forms
            </p>
          </motion.div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 p-3 border-2 border-margin-red bg-accent-coral/15 rounded-md font-cursive text-base text-margin-red"
            >
              ⚠ {error}
            </motion.div>
          )}

          <div className="space-y-3 mb-6">
            <motion.button
              whileHover={{ scale: 1.02, rotate: -0.5 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn-rough w-full justify-center py-3 text-base"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02, rotate: 0.5 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAppleSignIn}
              disabled={loading}
              className="btn-rough dark w-full justify-center py-3 text-base"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.08-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </motion.button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-dashed border-ink/30"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white font-cursive text-ink-soft text-base">
                or with email
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label className="font-marker text-sm text-ink mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-rough pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="font-marker text-sm text-ink mb-1.5 block">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-soft pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input-rough pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, rotate: -0.5 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="btn-rough primary w-full justify-center py-3 text-base"
            >
              <LogIn className="w-5 h-5" />
              {loading ? 'Please wait…' : isSignUp ? 'Sign Up' : 'Sign In'}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="font-cursive text-base text-ink-soft hover:text-ink transition-colors underline decoration-dashed underline-offset-4"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
