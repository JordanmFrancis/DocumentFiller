import { User as FirebaseUser } from 'firebase/auth';

export interface User extends FirebaseUser {
  // Additional user properties can be added here
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google' | 'apple' | 'email';
}
