/**
 * Firestore path: users/{uid}
 * Mirror: ios/Shared/UserProfile.swift
 */
export interface UserProfile {
  displayName?: string;
  email?: string;
  yearLevel?: 'Y7' | 'Y8' | 'Y9' | 'Y10' | 'Y11' | 'Y12';
  fitnessLevel?: 'basic' | 'average' | 'intense';
  activePlanId?: string | null;
  totalXp?: number;
  isCoach?: boolean;
  teamId?: string | null;
  teamName?: string;
  health?: {
    latestHr?: number;
    latestSteps?: number;
    latestSleep?: number;
    restingHr?: number;
    lastSync?: string;
  };
  createdAt?: FirestoreTimestamp;
}

export type FirestoreTimestamp =
  | { toDate(): Date }
  | { seconds: number; nanoseconds: number }
  | string;
