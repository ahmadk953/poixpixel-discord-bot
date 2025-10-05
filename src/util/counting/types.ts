import type { MILESTONE_REACTIONS } from './constants.js';

export interface CountingMistakeInfo {
  mistakes: number;
  warnings: number;
  lastUpdated: number;
}

export interface CountingBanMeta {
  expiresAt?: number | null;
  guildId?: string | null;
}

export interface CountingData {
  currentCount: number;
  lastUserId: string | null;
  highestCount: number;
  totalCorrect: number;
  bannedUsers: string[];
  bannedMeta: Record<string, CountingBanMeta>;
  mistakeTracker: Record<string, CountingMistakeInfo>;
}

export type CountingProcessInvalidReason =
  | 'banned'
  | 'ignored'
  | 'not_a_number'
  | 'too_high'
  | 'too_low'
  | 'same_user'
  | 'error';

export interface CountingProcessResult {
  isValid: boolean;
  expectedCount?: number;
  isMilestone?: boolean;
  milestoneType?: keyof typeof MILESTONE_REACTIONS;
  reason?: CountingProcessInvalidReason;
  rolledBackTo?: number;
}
