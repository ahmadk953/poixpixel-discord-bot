import type { Client, Guild, GuildMember } from 'discord.js';
import logAction from '../logging/logAction.js';
import { type MILESTONE_REACTIONS, REDIS_KEY } from './constants.js';
import type {
  CountingData,
  CountingBanMeta,
  CountingMistakeInfo,
} from './types.js';
import { setJson } from '@/db/redis.js';
import { unbanUser } from './countingManager.js';
import type { ModerationLogAction } from '../logging/types.js';
import { logger } from '../logger.js';

/**
 * Validates a positive integer.
 * @param maybe The value to validate.
 * @param fallback The fallback value to return on invalid input.
 * @param label The label to use in warning messages.
 * @returns The validated positive integer, or the fallback value.
 */
export function validatePositiveInt(
  maybe: number | undefined,
  fallback: number,
  label: string,
): number {
  if (typeof maybe !== 'number' || !Number.isInteger(maybe) || maybe < 1) {
    logger.warn(
      `[CountingManager] Invalid ${label}: ${maybe}. Falling back to ${fallback}.`,
    );
    return fallback;
  }
  return maybe;
}

/**
 * Persists the counting data to Redis.
 * @param data The counting data to persist.
 */
export async function persist(data: CountingData): Promise<void> {
  await setJson<CountingData>(REDIS_KEY, data);
}

/**
 * Migrates the counting data to the latest format.
 * TODO: Remove this function before v1 release.
 * @param data The counting data to migrate.
 * @returns The migrated counting data.
 */
export function migrateData(data: CountingData): CountingData {
  // Define the expected mutable shape for the migration. We create a
  // shallow-typed copy so TypeScript can validate property names and types
  // while we perform runtime checks and fixes.
  interface ExpectedCountingData {
    currentCount: number;
    lastUserId: string | null;
    highestCount: number;
    totalCorrect: number;
    bannedUsers: string[];
    bannedMeta: Record<string, CountingBanMeta>;
    mistakeTracker: Record<string, CountingMistakeInfo>;
  }

  // Start with a shallow copy to avoid mutating the original input until
  // we've validated/filled missing fields. Use Partial so we can incrementally
  // build the final object.
  const mutableData: Partial<ExpectedCountingData> = { ...data };

  let changed = false;

  if (!Array.isArray(mutableData.bannedUsers)) {
    mutableData.bannedUsers = [];
    changed = true;
  }

  if (
    !mutableData.bannedMeta ||
    typeof mutableData.bannedMeta !== 'object' ||
    Array.isArray(mutableData.bannedMeta)
  ) {
    mutableData.bannedMeta = {};
    changed = true;
  }

  if (
    !mutableData.mistakeTracker ||
    typeof mutableData.mistakeTracker !== 'object' ||
    Array.isArray(mutableData.mistakeTracker)
  ) {
    mutableData.mistakeTracker = {};
    changed = true;
  }

  if (changed) {
    const finalData: CountingData = {
      currentCount:
        typeof mutableData.currentCount === 'number'
          ? mutableData.currentCount
          : data.currentCount,
      lastUserId:
        mutableData.lastUserId === undefined
          ? data.lastUserId
          : mutableData.lastUserId,
      highestCount:
        typeof mutableData.highestCount === 'number'
          ? mutableData.highestCount
          : data.highestCount,
      totalCorrect:
        typeof mutableData.totalCorrect === 'number'
          ? mutableData.totalCorrect
          : data.totalCorrect,
      bannedUsers: mutableData.bannedUsers as string[],
      bannedMeta: mutableData.bannedMeta as Record<string, CountingBanMeta>,
      mistakeTracker: mutableData.mistakeTracker as Record<
        string,
        CountingMistakeInfo
      >,
    };

    void persist(finalData).catch((error) =>
      logger.error('[CountingManager] Failed to persist migrated data', error),
    );

    return finalData;
  }

  // Nothing changed; return the original data as-is.
  return data;
}

/** Determines the milestone type based on the count.
 * @param count The current count.
 * @returns The milestone type as a key of MILESTONE_REACTIONS.
 */
export function deriveMilestone(
  count: number,
): keyof typeof MILESTONE_REACTIONS {
  if (count % 100 === 0) return 'multiples100';
  if (count % 50 === 0) return 'multiples50';
  if (count % 25 === 0) return 'multiples25';
  return 'normal';
}

/**
 * Retrieves a member from a guild, safely handling potential errors.
 * @param guild The guild to retrieve the member from.
 * @param userId The ID of the user to retrieve.
 * @returns The guild member, or undefined if not found.
 */
export async function getMemberSafe(
  guild: Guild,
  userId: string,
): Promise<GuildMember | undefined> {
  return guild.members
    .fetch(userId)
    .catch(() => guild.members.cache.get(userId));
}

/**
 * Schedules an auto-unban for a user.
 * @param userId The ID of the user to unban.
 * @param delayMs The delay in milliseconds before the unban occurs.
 * @param activeAutoUnbans The map of active auto-unban timers.
 * @param guildId The ID of the guild in which the unban should occur.
 * @param client The Discord client instance.
 * @param reason The reason for the unban.
 */
export function scheduleAutoUnban(
  userId: string,
  delayMs: number,
  activeAutoUnbans: Map<string, ReturnType<typeof setTimeout>>,
  guildId?: string | null,
  client?: Client,
  reason?: string,
) {
  clearAutoUnbanTimer(userId, activeAutoUnbans);

  const timeout = setTimeout(async () => {
    try {
      let guild: Guild | undefined;
      if (guildId && client) {
        guild = await client.guilds.fetch(guildId).catch(() => undefined);
      }
      await unbanUser(userId, guild, undefined, reason);
    } catch (error) {
      logger.error('[CountingManager] Auto-unban execution failed', error);
    } finally {
      activeAutoUnbans.delete(userId);
    }
  }, delayMs);

  activeAutoUnbans.set(userId, timeout);
}

/**
 * Clears the auto-unban timer for a user.
 * @param userId The ID of the user whose auto-unban timer should be cleared.
 * @param activeAutoUnbans The map of active auto-unban timers.
 */
export function clearAutoUnbanTimer(
  userId: string,
  activeAutoUnbans: Map<string, ReturnType<typeof setTimeout>>,
) {
  const existing = activeAutoUnbans.get(userId);
  if (existing) {
    clearTimeout(existing);
    activeAutoUnbans.delete(userId);
  }
}

/**
 * Issues a counting log entry.
 * @param guild The guild in which the log is being issued.
 * @param action The action being logged.
 * @param param2 Additional parameters for the log entry.
 */
export async function issueCountingLog(
  guild: Guild,
  action:
    | 'countingBan'
    | 'countingUnban'
    | 'countingWarning'
    | 'clearCountingWarnings',
  {
    target,
    moderator,
    reason,
  }: {
    target?: GuildMember;
    moderator?: GuildMember;
    reason?: string;
  },
) {
  try {
    const moderatorResolved = moderator ?? guild.members.me ?? undefined;
    if (!moderatorResolved) {
      logger.warn(
        `[CountingManager] No moderator available to record ${action}; skipping log.`,
      );
      return;
    }

    const targetResolved = target ?? moderatorResolved;

    const reasonResolved =
      reason ??
      (() => {
        switch (action) {
          case 'countingBan':
            return 'User banned from counting';
          case 'countingUnban':
            return 'User unbanned from counting';
          case 'countingWarning':
            return 'Counting warning issued';
          case 'clearCountingWarnings':
            return 'Cleared counting warnings/mistakes';
          default:
            return 'Counting action';
        }
      })();

    const payload: ModerationLogAction = {
      guild,
      action,
      target: targetResolved,
      moderator: moderatorResolved,
      reason: reasonResolved,
    };

    await logAction(payload);
  } catch (error) {
    logger.error(`[CountingManager] Failed logAction (${action})`, error);
  }
}

/**
 * Sanitizes and evaluates a mathematical expression.
 * @param expr The mathematical expression to sanitize and evaluate.
 * @returns The result of the evaluation.
 */
export function sanitizeAndEval(expr: string): number {
  if (!/^[\d+\-*/()\s]+$/.test(expr)) {
    throw new Error('Invalid characters (integers only)');
  }

  if (expr.length > 64) throw new Error('Expression too long');

  let bal = 0;

  for (const c of expr) {
    if (c === '(') bal++;
    else if (c === ')') bal--;
    if (bal < 0) throw new Error('Unbalanced parentheses');
  }
  if (bal !== 0) throw new Error('Unbalanced parentheses');

  if (/[+*/]{2,}/.test(expr.replace(/--/g, ''))) {
    throw new Error('Invalid operator sequence');
  }
  if (/(\/\s*0(?!\d))/.test(expr)) throw new Error('Division by zero');
  if (/\(\s*\)/.test(expr)) throw new Error('Empty parentheses');
  if (/\b0\d+/.test(expr)) throw new Error('Leading zeros');

  let result: unknown;

  try {
    result = Function(`"use strict"; return (${expr})`)();
  } catch {
    throw new Error('Invalid mathematical expression');
  }

  if (
    typeof result !== 'number' ||
    !Number.isFinite(result) ||
    !Number.isInteger(result) ||
    result < 0
  ) {
    throw new Error('Expression did not evaluate to a non-negative integer');
  }

  return result;
}
