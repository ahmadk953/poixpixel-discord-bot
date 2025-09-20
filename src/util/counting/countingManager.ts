import { getJson } from '@/db/redis.js';
import {
  MAX_WARNINGS,
  MILESTONE_REACTIONS,
  MISTAKE_THRESHOLD,
  REDIS_KEY,
  WARNING_PERIOD_MS,
} from './constants.js';
import {
  CountingData,
  CountingProcessInvalidReason,
  CountingProcessResult,
} from './types.js';
import {
  clearAutoUnbanTimer,
  deriveMilestone,
  getMemberSafe,
  handleMistake,
  issueCountingLog,
  migrateData,
  persist,
  sanitizeAndEval,
  scheduleAutoUnban,
} from './helpers.js';
import { Client, Guild, GuildMember, Message } from 'discord.js';
import { msToDiscordTimestamp, safeDM } from '../helpers.js';

// =================================
//          Internal State
// =================================

/** Runtime map of scheduled unban timers (userId -> timeout handle) */
const activeAutoUnbans: Map<string, ReturnType<typeof setTimeout>> = new Map();

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
    if (data.mistakeTracker && data.mistakeTracker[userId]) {
      delete data.mistakeTracker[userId];
      await persist(data);

      if (guild) {
        const target = await getMemberSafe(guild, userId);
        await issueCountingLog(guild, 'clearCountingWarnings', {
          target,
          moderator: moderator ?? guild.members.me ?? undefined,
          reason: 'Cleared counting warnings/mistakes for user',
        });
      }
    }
  } catch (err) {
    console.error('[counting] Error clearing user mistakes:', err);
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
  } catch (err) {
    console.error('[counting] Error clearing all mistakes:', err);
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
      return { isValid: false, reason: 'banned' };
    }

    const raw = message.content.trim();

    // Quick filter: digits/operators/whitespace/parentheses only
    if (!/^[\d+\-*/().\s]+$/.test(raw)) {
      return { isValid: false, reason: 'ignored' };
    }

    let count: number;
    try {
      count = sanitizeAndEval(raw);
    } catch {
      const { warning, ban } = await handleMistake(
        message.author.id,
        message.guild ?? undefined,
        message.guild?.members?.me ?? undefined,
      );
      if (warning && !ban) {
        void safeDM(
          message,
          '⚠️ A mistake was detected. Repeated mistakes may lead to a counting ban.',
        );
      }

      // If we're above 100, do a soft rollback to the nearest magnitude instead of full reset
      if (data.currentCount > 100) {
        const mag = Math.pow(10, Math.floor(Math.log10(data.currentCount)));
        const rollbackTo = Math.floor(data.currentCount / mag) * mag;
        await setCount(rollbackTo);
        return {
          isValid: false,
          reason: 'not_a_number',
          rolledBackTo: rollbackTo,
        };
      }

      // No reset done here — handler will reset and show message
      return { isValid: false, reason: 'not_a_number' };
    }

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

      // Soft "rollback" logic
      if (data.currentCount > 100) {
        const mag = Math.pow(10, Math.floor(Math.log10(data.currentCount)));
        const rollbackTo = Math.floor(data.currentCount / mag) * mag;
        await setCount(rollbackTo);
        return {
          isValid: false,
          expectedCount: expected,
          reason,
          rolledBackTo: rollbackTo,
        };
      } else {
        await resetCounting();
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
      // If we're above 100 do a soft rollback; otherwise full reset to 0
      if (data.currentCount > 100) {
        const mag = Math.pow(10, Math.floor(Math.log10(data.currentCount)));
        const rollbackTo = Math.floor(data.currentCount / mag) * mag;
        await setCount(rollbackTo);
        return {
          isValid: false,
          expectedCount: expected,
          reason: 'same_user',
          rolledBackTo: rollbackTo,
        };
      } else {
        await resetCounting();
        return {
          isValid: false,
          expectedCount: expected,
          reason: 'same_user',
          rolledBackTo: 0,
        };
      }
    }

    const newCount = expected;
    const newHighest = Math.max(newCount, data.highestCount);
    await updateCountingData({
      currentCount: newCount,
      lastUserId: message.author.id,
      highestCount: newHighest,
      totalCorrect: data.totalCorrect + 1,
    });

    const milestoneType = deriveMilestone(newCount);
    return {
      isValid: true,
      expectedCount: newCount + 1,
      isMilestone: milestoneType !== 'normal',
      milestoneType,
    };
  } catch (err) {
    console.error('[counting] Error processing message:', err);
    return { isValid: false, reason: 'error' };
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
  } catch (err) {
    console.error('[counting] Failed adding reactions:', err);
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
  } catch (err) {
    console.error('[counting] Failed to rehydrate auto-unbans:', err);
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
        .catch(() => {
          console.warn(
            `[counting] Failed to DM user ${userId} about counting ban.`,
          );
        });
    }
  } catch (err) {
    console.error('[counting] Error banning user:', err);
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
    delete data.bannedMeta[userId];
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
        .catch(() => {
          console.warn(
            `[counting] Failed to DM user ${userId} about counting unban.`,
          );
        });
    }
  } catch (err) {
    console.error('[counting] Error unbanning user:', err);
  }
}

// =================================
//        Startup Rehydration
// =================================

rehydrateCountingAutoUnbans().catch((e) =>
  console.error('[counting] Rehydrate error (module load):', e),
);
