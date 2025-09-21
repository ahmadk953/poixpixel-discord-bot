import { loadConfig } from '../configLoader.js';
import { safeParseDuration } from './durationUtils.js';
import { validatePositiveInt } from './helpers.js';

export const REDIS_KEY = 'counting';

export const config = loadConfig();

const counting = (config.counting ?? {}) as Record<string, unknown>;

export const WARNING_PERIOD_MS = safeParseDuration(
  counting.warningPeriod as string | undefined,
  10 * 60 * 1000,
);

export const AUTO_BAN_DURATION_MS = safeParseDuration(
  counting.autoBanDuration as string | undefined,
  24 * 60 * 60 * 1000,
);

export const MISTAKE_THRESHOLD = validatePositiveInt(
  typeof counting.mistakeThreshold === 'number'
    ? (counting.mistakeThreshold as number)
    : undefined,
  5,
  'mistakeThreshold',
);
export const MAX_WARNINGS = validatePositiveInt(
  typeof counting.maxWarnings === 'number'
    ? (counting.maxWarnings as number)
    : undefined,
  3,
  'maxWarnings',
);

export const MILESTONE_REACTIONS = {
  normal: '✅',
  multiples25: '✨',
  multiples50: '⭐',
  multiples100: '🎉',
} as const;
