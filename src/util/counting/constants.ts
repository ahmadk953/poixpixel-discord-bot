import { loadConfig } from '../configLoader.js';
import { safeParseDuration, validatePositiveInt } from './helpers.js';

export const REDIS_KEY = 'counting';

export const config = loadConfig();

export const WARNING_PERIOD_MS = safeParseDuration(
  config.counting.warningPeriod,
  10 * 60 * 1000,
);

export const AUTO_BAN_DURATION_MS = safeParseDuration(
  config.counting.autoBanDuration,
  24 * 60 * 60 * 1000,
);

export const MISTAKE_THRESHOLD = validatePositiveInt(
  config.counting.mistakeThreshold,
  5,
  'mistakeThreshold',
);
export const MAX_WARNINGS = validatePositiveInt(
  config.counting.maxWarnings,
  3,
  'maxWarnings',
);

export const MILESTONE_REACTIONS = {
  normal: '✅',
  multiples25: '✨',
  multiples50: '⭐',
  multiples100: '🎉',
} as const;
