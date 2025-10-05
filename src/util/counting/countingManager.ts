import { getJson } from '@/db/redis.js';
import {
  AUTO_BAN_DURATION_MS,
  MAX_WARNINGS,
  MILESTONE_REACTIONS,
  MISTAKE_THRESHOLD,
  REDIS_KEY,
  WARNING_PERIOD_MS,
} from './constants.js';
import type {
  CountingData,
  CountingMistakeInfo,
  CountingProcessInvalidReason,
  CountingProcessResult,
} from './types.js';
import {
  clearAutoUnbanTimer,
  deriveMilestone,
  getMemberSafe,
  issueCountingLog,
  migrateData,
  persist,
  sanitizeAndEval,
  scheduleAutoUnban,
} from './helpers.js';
import type { Client, Guild, GuildMember, Message } from 'discord.js';
import { msToDiscordTimestamp, safeDM } from '../helpers.js';
import { logger } from '../logger.js';

// =================================
//          Internal State
// =================================

/** Runtime map of scheduled unban timers (userId -> timeout handle) */
const activeAutoUnbans = new Map<string, ReturnType<typeof setTimeout>>();

// =================================
//         Public Functions
// =================================

/**
 * Initializes the counting data for a guild.
 * @returns The initialized counting data.
 */
export async function initializeCountingData(): Promise<CountingData> {
  const existing = await getJson<CountingData>(REDIS_KEY);
  if (existing) return migrateData(existing);

  const fresh: CountingData = {
    currentCount: 0,
    lastUserId: null,
    highestCount: 0,
    totalCorrect: 0,
    bannedUsers: [],
    bannedMeta: {},
    mistakeTracker: {},
  };
  await persist(fresh);
  return fresh;
}

/**
 * Retrieves the counting data for a guild.
 * @returns The counting data.
 */
export async function getCountingData(): Promise<CountingData> {
  const data = await getJson<CountingData>(REDIS_KEY);
  return data ? migrateData(data) : initializeCountingData();
}

/**
 * Updates the counting data for a guild.
 * @param patch The partial counting data to update.
 */
export async function updateCountingData(
  patch: Partial<CountingData>,
): Promise<void> {
  const current = await getCountingData();
  const updated: CountingData = {
    ...current,
    ...patch,
    // safeguard nested objects (patch may accidentally null them out)
    bannedUsers: patch.bannedUsers ?? current.bannedUsers,
    bannedMeta: patch.bannedMeta ?? current.bannedMeta,
    mistakeTracker: patch.mistakeTracker ?? current.mistakeTracker,
  };
  await persist(updated);
}

/**
 * Resets the counting data for a guild.
 */
export async function resetCounting(): Promise<void> {
  await updateCountingData({ currentCount: 0, lastUserId: null });
}

/**
 * Clear mistake/warning tracking for a single user.
 * @param userId The user to clear mistakes for.
 * @param guild Optional guild for logging.
 * @param moderator Optional moderator that performed this action (for logging).
 */
export async function clearUserMistakes(
  userId: string,
  guild?: Guild,
  moderator?: GuildMember,
): Promise<void> {
  try {
    const data = await getCountingData();
    if (data.mistakeTracker?.[userId]) {
      // avoid using `delete` on dynamic keys; create a new object without the key
      const { [userId]: _removed, ...rest } = data.mistakeTracker ?? {};
      data.mistakeTracker = rest;
      await persist(data);

      if (guild) {
        const target = await getMemberSafe(guild, userId);
        await issueCountingLog(guild, 'clearCountingWarnings', {
          target,
          moderator: moderator ?? guild.members.me ?? undefined,
          reason: 'Cleared counting warnings/mistakes for user',
        });
      }

      logger.info('[CountingManager] Cleared mistakes for user', {
        user: userId.slice(-4),
        moderator: moderator?.id.slice(-4) ?? undefined,
      });
    }
  } catch (error) {
    logger.error('[CountingManager] Failed to clear user mistakes', error);
  }
}

/**
 * Clear all mistake/warning tracking for everyone.
 * @param guild Optional guild for logging.
 * @param moderator Optional moderator that performed this action (for logging).
 */
export async function clearAllMistakes(
  guild?: Guild,
  moderator?: GuildMember,
): Promise<void> {
  try {
    const data = await getCountingData();
    data.mistakeTracker = {};
    await persist(data);

    if (guild) {
      await issueCountingLog(guild, 'clearCountingWarnings', {
        moderator: moderator ?? guild.members.me ?? undefined,
        reason: 'Cleared all counting warnings/mistakes',
      });
    }

    logger.info('[CountingManager] Cleared all mistakes for everyone', {
      moderator: moderator?.id.slice(-4) ?? undefined,
    });
  } catch (error) {
    logger.error(
      '[CountingManager] Failed to clear all mistakes for everyone',
      error,
    );
  }
}

/**
 * Processes a counting message and returns the result.
 * @param message The message to process.
 * @returns The result of the counting process.
 */
export async function processCountingMessage(
  message: Message,
): Promise<CountingProcessResult> {
  try {
    const data = await getCountingData();

    if (data.bannedUsers.includes(message.author.id)) {
      logger.debug('[CountingManager] Ignored message from banned user', {
        user: message.author.id.slice(-4),
      });
      return { isValid: false, reason: 'banned' };
    }

    const trimmed = message.content.trim();

    async function invalidNumberRollbackOrReset(
      currData: CountingData,
      msg: Message,
      _trimmedContent: string,
    ): Promise<CountingProcessResult> {
      if (currData.currentCount > 100) {
        const mag = Math.pow(10, Math.floor(Math.log10(currData.currentCount)));
        const rollbackTo = Math.floor(currData.currentCount / mag) * mag;
        await setCount(rollbackTo);

        logger.debug('[CountingManager] Invalid number caused rollback', {
          user: msg.author.id.slice(-4),
          previousCount: currData.currentCount,
          rolledBackTo: rollbackTo,
        });

        return {
          isValid: false,
          reason: 'not_a_number',
          rolledBackTo: rollbackTo,
        };
      }

      logger.debug('[CountingManager] Invalid number caused reset', {
        user: msg.author.id.slice(-4),
        previousCount: currData.currentCount,
      });

      return { isValid: false, reason: 'not_a_number' };
    }

    let evaluated: number | null;
    try {
      evaluated = sanitizeAndEval(trimmed);
    } catch {
      await handleMistake(
        message.author.id,
        message.guild ?? undefined,
        message.guild?.members?.me ?? undefined,
      );

      void safeDM(
        message,
        '⚠️ A mistake was detected. Repeated mistakes may lead to a counting ban.',
      );

      return await invalidNumberRollbackOrReset(data, message, trimmed);
    }

    const count = evaluated;
    const expected = data.currentCount + 1;

    if (count !== expected) {
      const reason: CountingProcessInvalidReason =
        count > expected ? 'too_high' : 'too_low';

      const { warning, warningsCount } = await handleMistake(
        message.author.id,
        message.guild ?? undefined,
        message.guild?.members?.me ?? undefined,
      );

      if (warning) {
        void safeDM(
          message,
          `⚠️ You reached ${MISTAKE_THRESHOLD} mistakes. Warning ${warningsCount}/${MAX_WARNINGS}. Warnings reset ${msToDiscordTimestamp(Date.now() + WARNING_PERIOD_MS)}.`,
        );
      }

      if (data.currentCount > 100) {
        const mag = Math.pow(10, Math.floor(Math.log10(data.currentCount)));
        const rollbackTo = Math.floor(data.currentCount / mag) * mag;
        await setCount(rollbackTo);

        logger.debug('[CountingManager] Wrong number caused rollback', {
          user: message.author.id.slice(-4),
          expected,
          actual: count,
          reason,
          previousCount: data.currentCount,
          rolledBackTo: rollbackTo,
        });

        return {
          isValid: false,
          expectedCount: expected,
          reason,
          rolledBackTo: rollbackTo,
        };
      } else {
        await resetCounting();

        logger.debug('[CountingManager] Wrong number caused reset', {
          user: message.author.id.slice(-4),
          expected,
          actual: count,
          reason,
          previousCount: data.currentCount,
        });

        return {
          isValid: false,
          expectedCount: expected,
          reason,
          rolledBackTo: 0,
        };
      }
    }

    if (data.lastUserId === message.author.id) {
      await handleMistake(
        message.author.id,
        message.guild ?? undefined,
        message.guild?.members?.me ?? undefined,
      );

      if (data.currentCount > 100) {
        const mag = Math.pow(10, Math.floor(Math.log10(data.currentCount)));
        const rollbackTo = Math.floor(data.currentCount / mag) * mag;
        await setCount(rollbackTo);

        logger.debug('[CountingManager] Double count caused rollback', {
          user: message.author.id.slice(-4),
          count: data.currentCount,
          rolledBackTo: rollbackTo,
        });

        return {
          isValid: false,
          expectedCount: expected,
          reason: 'same_user',
          rolledBackTo: rollbackTo,
        };
      } else {
        await resetCounting();

        logger.debug('[CountingManager] Double count caused reset', {
          user: message.author.id.slice(-4),
          count: data.currentCount,
        });

        return {
          isValid: false,
          expectedCount: expected,
          reason: 'same_user',
          rolledBackTo: 0,
        };
      }
    }

    const newCount = expected;
    data.currentCount = newCount;
    data.lastUserId = message.author.id;

    if (data.currentCount > data.highestCount) {
      data.highestCount = data.currentCount;
      logger.debug('[CountingManager] New record reached', {
        count: data.highestCount,
        user: message.author.id.slice(-4),
      });
    }

    data.totalCorrect += 1;
    await persist(data);

    const milestoneType = deriveMilestone(newCount);

    logger.debug('[CountingManager] Valid count processed', {
      count: newCount,
      user: message.author.id.slice(-4),
      milestone: milestoneType !== 'normal',
    });

    return {
      isValid: true,
      expectedCount: newCount + 1,
      isMilestone: milestoneType !== 'normal',
      milestoneType,
    };
  } catch (error) {
    logger.error('[CountingManager] Failed to process counting message', error);
    return { isValid: false, reason: 'ignored' };
  }
}

/**
 * Adds reactions to a counting message based on its milestone type.
 * @param message The message to add reactions to.
 * @param milestoneType The type of milestone reached.
 */
export async function addCountingReactions(
  message: Message,
  milestoneType: keyof typeof MILESTONE_REACTIONS,
): Promise<void> {
  try {
    await message.react(MILESTONE_REACTIONS[milestoneType]);
    if (milestoneType === 'multiples100') {
      await message.react('💯');
    }
  } catch (error) {
    logger.error('[CountingManager] Failed adding reactions', error);
  }
}

/**
 * Retrieves the current counting status.
 * @returns The current counting status.
 */
export async function getCountingStatus(): Promise<string> {
  const data = await getCountingData();
  return `Current count: ${data.currentCount}\nHighest count ever: ${data.highestCount}\nTotal correct counts: ${data.totalCorrect}`;
}

/**
 * Sets the current count.
 * @param count The new count value.
 */
export async function setCount(count: number): Promise<void> {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Count must be a non-negative integer.');
  }
  await updateCountingData({ currentCount: count, lastUserId: null });
}

/**
 * Rehydrates the counting auto-unbans for offline users.
 * @param client The Discord client.
 */
export async function rehydrateCountingAutoUnbans(
  client?: Client,
): Promise<void> {
  try {
    const data = await getCountingData();
    const now = Date.now();

    for (const [userId, meta] of Object.entries(data.bannedMeta ?? {})) {
      if (!meta?.expiresAt) continue;

      if (meta.expiresAt <= now) {
        await unbanUser(
          userId,
          client && meta.guildId
            ? await client.guilds.fetch(meta.guildId).catch(() => undefined)
            : undefined,
          undefined,
          'Temporary counting ban expired while offline',
        );
        continue;
      }

      const remaining = meta.expiresAt - now;
      scheduleAutoUnban(
        userId,
        remaining,
        activeAutoUnbans,
        meta.guildId,
        client,
        'Temporary counting ban expired',
      );
    }
  } catch (error) {
    logger.error('[CountingManager] Failed to rehydrate auto-unbans', error);
  }
}

/**
 * Bans a user from counting.
 * @param userId The ID of the user to ban.
 * @param guild The guild in which to ban the user.
 * @param moderator The moderator who is issuing the ban.
 * @param reason The reason for the ban.
 * @param durationMs The duration of the ban in milliseconds.
 */
export async function banUser(
  userId: string,
  guild?: Guild,
  moderator?: GuildMember,
  reason?: string,
  durationMs?: number,
): Promise<void> {
  try {
    const data = await getCountingData();
    if (!data.bannedUsers.includes(userId)) {
      data.bannedUsers.push(userId);
    }

    data.bannedMeta[userId] = {
      expiresAt: durationMs && durationMs > 0 ? Date.now() + durationMs : null,
      guildId: guild?.id ?? null,
    };
    await persist(data);

    if (durationMs && durationMs > 0) {
      scheduleAutoUnban(
        userId,
        durationMs,
        activeAutoUnbans,
        guild?.id,
        guild?.client,
        'Temporary counting ban expired',
      );
    }

    if (guild) {
      const target = await getMemberSafe(guild, userId);
      const durationText =
        durationMs && durationMs > 0
          ? ` (expires ${msToDiscordTimestamp(Date.now() + durationMs)})`
          : '';

      await issueCountingLog(guild, 'countingBan', {
        target,
        moderator: moderator ?? guild.members.me ?? undefined,
        reason: (reason ?? 'Banned from counting') + durationText,
      });

      void target
        ?.send(
          `You have been banned from counting. Reason: ${reason ?? 'Banned from counting'}${durationText}`,
        )
        .catch((error) => {
          logger.warn(
            `[CountingManager] Failed to DM user ${target.id.slice(-4)} about counting ban`,
            error,
          );
        });
    }
  } catch (error) {
    logger.error('[CountingManager] Error banning user', error);
  }
}

/**
 * Unbans a user from counting.
 * @param userId The ID of the user to unban.
 * @param guild The guild in which to unban the user.
 * @param moderator The moderator who is issuing the unban.
 * @param reason The reason for the unban.
 */
export async function unbanUser(
  userId: string,
  guild?: Guild,
  moderator?: GuildMember,
  reason?: string,
): Promise<void> {
  try {
    const data = await getCountingData();
    data.bannedUsers = data.bannedUsers.filter((u) => u !== userId);
    // avoid `delete` by reconstructing bannedMeta without the removed key
    const { [userId]: _removedMeta, ...remainingMeta } = data.bannedMeta ?? {};
    data.bannedMeta = remainingMeta;
    await persist(data);
    clearAutoUnbanTimer(userId, activeAutoUnbans);

    if (guild) {
      const target = await getMemberSafe(guild, userId);
      await issueCountingLog(guild, 'countingUnban', {
        target,
        moderator: moderator ?? guild.members.me ?? undefined,
        reason: reason ?? 'Unbanned from counting',
      });

      void target
        ?.send(
          `You have been unbanned from counting. Reason: ${reason ?? 'Unbanned from counting'}`,
        )
        .catch((error) => {
          logger.warn('[CountingManager] Could not DM user about unban', error);
        });
    }

    logger.info('[CountingManager] User unbanned', {
      user: userId.slice(-4),
      moderator: moderator?.id.slice(-4),
      reason,
    });
  } catch (error) {
    logger.error('[CountingManager] Failed to unban user', error);
  }
}

/**
 * Handles a counting mistake for a user.
 * @param userId The ID of the user who made the mistake.
 * @param guild The guild in which the mistake occurred.
 * @param moderator The moderator who is handling the mistake.
 * @returns An object containing information about the mistake handling.
 */
async function handleMistake(
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
        } catch (error) {
          logger.error(
            '[CountingManager] Failed logging countingWarning:',
            error,
          );
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
      } catch (error) {
        logger.error(
          '[CountingManager] Failed escalating to ban after mistakes',
          error,
        );
      }
    }

    return { warning, ban, warningsCount: info.warnings };
  } catch (error) {
    logger.error('[CountingManager] Error handling mistake', error);
    return { warning: false, ban: false, warningsCount: 0 };
  }
}
