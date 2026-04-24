import type { FirestoreTimestamp } from './user-profile';

/**
 * Firestore path: users/{uid}/workouts/{autoId}
 * Mirror: ios/Shared/Workout.swift
 *
 * Written by:
 *   - web app manual log  → source: undefined or 'manual'
 *   - web tracker (GPS)   → source: 'tracker'
 *   - Strava sync         → source: 'strava'
 *   - Watch session       → source: 'watch'
 */
export interface Workout {
  name: string;
  type?: 'hpv' | 'ride' | 'run' | 'treadmill' | 'walk' | 'gym' | 'strength' | 'cardio' | 'flexibility' | 'workout';
  date: FirestoreTimestamp;
  duration?: number; // minutes
  distanceKm?: number;
  heartRate?: {
    avg?: number;
    max?: number;
    min?: number;
  };
  energyKcal?: number;
  notes?: string;
  source?: 'manual' | 'tracker' | 'strava' | 'watch';
  activityType?: 'cycling' | 'running' | 'walking' | 'other';
  // Routes saved to localStorage by tracker.js/strava.js are NOT stored in Firestore.
}
