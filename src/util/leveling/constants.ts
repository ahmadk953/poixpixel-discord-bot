import { loadConfig } from '../configLoader.js';

const config = loadConfig();

const leveling = (config.leveling ?? {}) as Record<string, unknown>;

function parseConfigNumber(
  value: unknown,
  defaultValue: number,
  name: string
): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (parsed === undefined || parsed === null) {
    return defaultValue;
  }

  const num = Number(parsed);
  if (Number.isNaN(num) || !Number.isFinite(num) || num < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return num;
}

export const MIN_XP = parseConfigNumber(
  leveling.minXpAwarded,
  5,
  'Minimum XP awarded'
);
export const MAX_XP = parseConfigNumber(
  leveling.maxXpAwarded,
  15,
  'Maximum XP awarded'
);

if (MIN_XP > MAX_XP) {
  throw new Error(
    'Minimum XP awarded must be less than or equal to maximum XP awarded.'
  );
}

export const XP_COOLDOWN =
  parseConfigNumber(leveling.xpCooldown, 60, 'XP cooldown') * 1000;

export const DEFAULT_BATCH_SIZE = 200;
