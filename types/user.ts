import { User as FirebaseUser } from 'firebase/auth';

export interface User extends FirebaseUser {
  // Additional user properties can be added here
}

/**
 * Per-user profile values that auto-fill across every document the user opens,
 * matched by case-insensitive field label.
 */
export interface ProfileDefaults {
  uid: string;
  defaults: Array<{
    label: string;
    value: string | boolean | number;
  }>;
  updatedAt: Date;
}
