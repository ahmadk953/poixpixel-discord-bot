import type { MILESTONE_REACTIONS } from './constants.js';

export interface CountingMistakeInfo {
  lastUpdated: number;
  mistakes: number;
  warnings: number;
}

export interface CountingBanMeta {
  expiresAt?: number | null;
  guildId?: string | null;
}

export interface CountingData {
  bannedMeta: Record<string, CountingBanMeta>;
  bannedUsers: string[];
  currentCount: number;
  highestCount: number;
  lastUserId: string | null;
  mistakeTracker: Record<string, CountingMistakeInfo>;
  totalCorrect: number;
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
  expectedCount?: number;
  isMilestone?: boolean;
  isValid: boolean;
  milestoneType?: keyof typeof MILESTONE_REACTIONS;
  reason?: CountingProcessInvalidReason;
  rolledBackTo?: number;
}
