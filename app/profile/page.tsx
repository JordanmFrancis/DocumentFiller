'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Loader2, ArrowLeft } from 'lucide-react';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import Header from '@/components/Layout/Header';
import { getProfile, saveProfile } from '@/lib/firestore/profile';
import { ProfileDefaults } from '@/types/user';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuthContext();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAt, setSavingAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const p = await getProfile(user.uid);
        setProfile(p);
      } catch (e) {
        console.error('Error loading profile:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Debounced auto-save: 600ms after the last edit.
  useEffect(() => {
    if (!profile || loading) return;
    const handle = setTimeout(async () => {
      try {
        await saveProfile(profile);
        setSavingAt(new Date());
      } catch (e) {
        console.error('Error saving profile:', e);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [profile, loading]);

  function updateRow(idx: number, patch: Partial<{ label: string; value: string }>) {
    if (!profile) return;
    const next = [...profile.defaults];
    next[idx] = { ...next[idx], ...patch };
    setProfile({ ...profile, defaults: next });
  }

  function removeRow(idx: number) {
    if (!profile) return;
    const next = profile.defaults.filter((_, i) => i !== idx);
    setProfile({ ...profile, defaults: next });
  }

  function addRow() {
    if (!profile) return;
    setProfile({
      ...profile,
      defaults: [...profile.defaults, { label: '', value: '' }],
    });
  }

  if (authLoading || loading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="max-w-[720px] mx-auto px-8 py-10">
        <button
          onClick={() => router.push('/')}
          className="btn btn-ghost btn-sm mb-6 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="font-serif text-2xl text-ink mb-2">Your profile</h1>
        <p className="text-sm text-ink-faint mb-8">
          Values you set here pre-fill any document field whose label matches —
          case-insensitive, exact match. You can override per-document at any
          time.
        </p>

        <div className="space-y-2">
          {profile.defaults.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                value={row.label}
                onChange={(e) => updateRow(idx, { label: e.target.value })}
                placeholder="Field label (e.g. Full Name)"
                className="input flex-[2]"
              />
              <input
                type="text"
                value={String(row.value ?? '')}
                onChange={(e) => updateRow(idx, { value: e.target.value })}
                placeholder="Value"
                className="input flex-[3]"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="btn btn-ghost btn-sm"
                title="Remove"
                aria-label="Remove row"
              >
                <X className="w-4 h-4 text-ink-faint" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="btn btn-ghost btn-sm mt-3 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add field
        </button>

        {savingAt && (
          <p className="text-xs text-ink-faint mt-6">
            Auto-saved · {savingAt.toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  );
}
