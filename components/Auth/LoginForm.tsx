'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail } from '@/lib/firebase/auth';
import { Mail, Lock, ArrowRight } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center bg-paper p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-[400px]"
      >
        {/* Brand — logo tilts on hover */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="co-ico co-ico-tilt w-9 h-9 rounded-md bg-accent text-paper-card flex items-center justify-center font-serif text-xl leading-none cursor-pointer">
            C
          </div>
          <span className="font-serif text-[22px] text-ink leading-none">Counsel</span>
        </div>

        <div className="surface-elev p-7">
          <div className="text-center mb-6">
            <h1 className="font-serif text-[26px] text-ink leading-tight mb-1">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h1>
            <p className="text-ink-soft text-[14px]">
              {isSignUp
                ? 'Start filling PDFs in minutes'
                : 'Sign in to continue with your documents'}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-danger-tint border border-danger/30 rounded-md text-danger text-[13px]"
            >
              {error}
            </motion.div>
          )}

          <div className="space-y-2.5 mb-5">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="btn btn-outline w-full justify-center py-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              onClick={handleAppleSignIn}
              disabled={loading}
              className="btn btn-dark w-full justify-center py-2.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.08-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button>
          </div>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full hairline" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-paper-elev text-ink-faint text-[12px] uppercase tracking-wider">
                or
              </span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div>
              <label className="field-label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input pl-9"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="field-label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="input pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
              {!loading && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[13px] text-ink-soft hover:text-ink transition-colors"
            >
              {isSignUp ? (
                <>Already have an account? <span className="text-accent">Sign in</span></>
              ) : (
                <>Don't have an account? <span className="text-accent">Sign up</span></>
              )}
            </button>
          </div>
        </div>

        <p className="text-center text-[12px] text-ink-faint mt-5">
          By continuing, you agree to our terms.
        </p>
      </motion.div>
    </div>
  );
}
