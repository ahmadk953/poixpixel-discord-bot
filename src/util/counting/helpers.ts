import { Client, Guild, GuildMember } from 'discord.js';
import logAction from '../logging/logAction.js';
import {
  AUTO_BAN_DURATION_MS,
  MAX_WARNINGS,
  MILESTONE_REACTIONS,
  MISTAKE_THRESHOLD,
  REDIS_KEY,
  WARNING_PERIOD_MS,
} from './constants.js';
import { CountingData, CountingMistakeInfo } from './types.js';
import { setJson } from '@/db/redis.js';
import { parseDuration } from '../helpers.js';
import { banUser, getCountingData, unbanUser } from './countingManager.js';

/**
 * Safely parses a duration string into milliseconds.
 * @param raw The raw duration string to parse.
 * @param fallback The fallback value to return on error.
 * @returns The parsed duration in milliseconds, or the fallback value.
 */
export function safeParseDuration(
  raw: string | undefined,
  fallback: number,
): number {
  try {
    if (!raw) return fallback;
    return parseDuration(raw);
  } catch {
    return fallback;
  }
}

/**
 * Validates a positive integer.
 * @param maybe The value to validate.
 * @param fallback The fallback value to return on invalid input.
 * @param label The label to use in error messages.
 * @returns The validated positive integer, or the fallback value.
 */
export function validatePositiveInt(
  maybe: number | undefined,
  fallback: number,
  label: string,
): number {
  if (typeof maybe !== 'number' || !Number.isInteger(maybe) || maybe < 1) {
    console.error(
      `[counting] Invalid ${label}: ${maybe}. Falling back to ${fallback}.`,
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
 * TODO: Remove this function after a few months.
 * @param data The counting data to migrate.
 * @returns The migrated counting data.
 */
export function migrateData(data: CountingData): CountingData {
  let changed = false;
  if (!Array.isArray(data.bannedUsers)) {
    (data as any).bannedUsers = [];
    changed = true;
  }
  if (!data.bannedMeta || typeof data.bannedMeta !== 'object') {
    (data as any).bannedMeta = {};
    changed = true;
  }
  if (!data.mistakeTracker || typeof data.mistakeTracker !== 'object') {
    (data as any).mistakeTracker = {};
    changed = true;
  }
  if (changed) {
    void persist(data).catch((e) =>
      console.error('[counting] Failed persisting migration:', e),
    );
  }
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
    } catch (e) {
      console.error('[counting] Auto-unban execution failed:', e);
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
    await logAction({
      guild,
      action,
      target,
      moderator,
      reason,
    } as any);
  } catch (err) {
    console.error(`[counting] Failed logAction (${action}):`, err);
  }
}

/**
 * Sanitizes and evaluates a mathematical expression.
 * @param expr The mathematical expression to sanitize and evaluate.
 * @returns The result of the evaluation.
 */
export function sanitizeAndEval(expr: string): number {
  if (!/^[\d+\-*/().\s]+$/.test(expr)) throw new Error('Invalid characters');

  // Disallow chained operators (except handling "--" => plus)
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

/**
 * Handles a counting mistake for a user.
 * @param userId The ID of the user who made the mistake.
 * @param guild The guild in which the mistake occurred.
 * @param moderator The moderator who is handling the mistake.
 * @returns An object containing information about the mistake handling.
 */
export async function handleMistake(
  userId: string,
  guild?: Guild,
  moderator?: GuildMember,
): Promise<{ warning: boolean; ban: boolean; warningsCount: number }> {
  try {
    const data = await getCountingData();
    const now = Date.now();

    const info: CountingMistakeInfo = data.mistakeTracker[userId] ?? {
      mistakes: 0,
      warnings: 0,
      lastUpdated: now,
    };

    if (now - info.lastUpdated > WARNING_PERIOD_MS) {
      info.mistakes = 0;
      info.warnings = 0;
    }

    info.lastUpdated = now;
    info.mistakes += 1;

    let warning = false;
    let ban = false;

    if (info.mistakes >= MISTAKE_THRESHOLD) {
      info.warnings += 1;
      info.mistakes = 0;
      warning = true;

      if (guild) {
        try {
          const target = await getMemberSafe(guild, userId);
          await issueCountingLog(guild, 'countingWarning', {
            target,
            moderator: moderator ?? guild.members.me ?? undefined,
            reason: `Warning ${info.warnings}/${MAX_WARNINGS} for counting mistakes`,
          });
        } catch (err) {
          console.error('[counting] Failed logging countingWarning:', err);
        }
      }

      if (info.warnings >= MAX_WARNINGS) {
        ban = true;
        if (!data.bannedUsers.includes(userId)) {
          data.bannedUsers.push(userId);
        }
      }
    }

    data.mistakeTracker[userId] = info;
    await persist(data);

    if (ban) {
      try {
        const duration =
          AUTO_BAN_DURATION_MS > 0 ? AUTO_BAN_DURATION_MS : undefined;
        await banUser(
          userId,
          guild,
          moderator,
          'Automatically banned from counting due to repeated mistakes',
          duration,
        );
      } catch (err) {
        console.error(
          '[counting] Failed escalating to ban after mistakes:',
          err,
        );
      }
    }

    return { warning, ban, warningsCount: info.warnings };
  } catch (err) {
    console.error('[counting] Error handling mistake:', err);
    return { warning: false, ban: false, warningsCount: 0 };
  }
}
