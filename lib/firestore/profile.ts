// lib/firestore/profile.ts
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ProfileDefaults } from '@/types/user';

const PROFILES_COLLECTION = 'userProfiles';

interface ProfileData {
  uid: string;
  defaults: Array<{
    label: string;
    value: string | boolean | number;
  }>;
  updatedAt: Timestamp;
}

const REALTOR_SEED_LABELS = [
  'Full Name',
  'License #',
  'Brokerage Name',
  'Brokerage Address',
  'Brokerage Phone',
  'Email',
];

export async function getProfile(uid: string): Promise<ProfileDefaults> {
  const ref = doc(db, PROFILES_COLLECTION, uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Seed labels with empty values on first read so the UI has something
    // to render. The seed is NOT written to Firestore until the user saves;
    // a brand-new account doesn't pollute storage with empty rows.
    return {
      uid,
      defaults: REALTOR_SEED_LABELS.map((label) => ({ label, value: '' })),
      updatedAt: new Date(),
    };
  }

  const data = snap.data() as ProfileData;
  return {
    uid: data.uid,
    defaults: data.defaults || [],
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
  };
}

export async function saveProfile(profile: ProfileDefaults): Promise<void> {
  const ref = doc(db, PROFILES_COLLECTION, profile.uid);
  // Drop entries with empty label OR empty string value — they're noise.
  const cleaned = profile.defaults.filter(
    (d) =>
      d.label.trim() !== '' &&
      !(typeof d.value === 'string' && d.value.trim() === '')
  );
  const data: ProfileData = {
    uid: profile.uid,
    defaults: cleaned,
    updatedAt: Timestamp.now(),
  };
  await setDoc(ref, data);
}
