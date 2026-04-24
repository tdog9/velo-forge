/**
 * Firestore path: users/{uid}/planOverrides/{planId}
 * Mirror: ios/Shared/PlanOverride.swift
 *
 * Rescheduled plan workouts. Identity per entry is (week, day) — all workouts
 * scheduled that day shift together. Keyed by planId because a user may cycle
 * through multiple library plans and each has its own override sheet.
 */
export interface PlanOverrideDoc {
  entries: PlanOverrideEntry[];
  updatedAt?: string; // ISO date
}

export interface PlanOverrideEntry {
  week: number;         // 1..durationWeeks within the plan
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  shiftedTo: string;    // ISO YYYY-MM-DD — the date the session now occurs on
  shiftedAt: string;    // ISO timestamp — when the shift was recorded
}
