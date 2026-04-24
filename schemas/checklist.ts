import type { FirestoreTimestamp } from './user-profile';

/**
 * Firestore path: users/{uid}/checklist/{YYYY-MM-DD}
 *
 * Per-day checklist of completed plan workouts. `items` keys are of the form
 * `${planId}-${week}-${day}-${sameWeekDayIdx}` where sameWeekDayIdx is the
 * index among workouts in the plan that share the same (week, day). Note:
 * legacy keys used index-within-today-filter and may still exist in older
 * user data — they just won't match the canonical progress-percent computation.
 */
export interface ChecklistDoc {
  items: Record<string, boolean>;
  updatedAt?: FirestoreTimestamp;
}
