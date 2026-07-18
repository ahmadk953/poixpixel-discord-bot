import { and, eq, inArray } from 'drizzle-orm';

import { db, ensureDbInitialized } from '@/db/db.js';
import { removeAllUserAchievements } from '@/db/functions/achievementFunctions.js';
import { deleteUserLevel } from '@/db/functions/levelFunctions.js';
import { memberTable, moderationTable } from '@/db/schema.js';
import { loadConfig } from './configLoader.js';
import { logger } from './logger.js';

/**
 * Schedule periodic cleanup of user level/achievement data based on config.
 */
export function scheduleUserDataRetentionCleanup() {
  const config = loadConfig();
  const retentionDays = config.dataRetention?.deleteAfterDays ?? 0;
  const postBanGraceDays = config.dataRetention?.postBanGraceDays ?? 3;

  if (!retentionDays || retentionDays <= 0) {
    logger.info('[DataRetention] retention disabled');
    return;
  }

  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const graceMs = postBanGraceDays * 24 * 60 * 60 * 1000;

  const runCleanup = async () => {
    try {
      await ensureDbInitialized();
      if (!db) {
        return;
      }

      const cutoff = new Date(Date.now() - retentionMs);

      // Fetch all members who are recorded as not in-server
      const candidates = await db
        .select()
        .from(memberTable)
        .where(eq(memberTable.currentlyInServer, false));

      if (candidates.length === 0) {
        return;
      }

      // Collect IDs and fetch any active bans for them in one query
      const ids = candidates
        .map((c) => c.discordId)
        .filter(Boolean) as string[];

      const allActiveBans =
        ids.length > 0
          ? await db
              .select()
              .from(moderationTable)
              .where(
                and(
                  eq(moderationTable.action, 'ban'),
                  eq(moderationTable.active, true),
                  inArray(moderationTable.discordId, ids)
                )
              )
          : [];

      const bansById = groupBansByDiscordId(allActiveBans);

      for (const member of candidates) {
        await cleanupMemberIfEligible(member, cutoff, bansById, graceMs);
      }
    } catch (error) {
      logger.error('[DataRetention] Cleanup error', error);
    }
  };

  async function cleanupMemberIfEligible(
    member: { discordId: string; lastLeftAt: string | Date | null },
    cutoff: Date,
    bansById: Map<string, Array<{ discordId: string; expiresAt: Date | null }>>,
    graceMs: number
  ) {
    if (!isMemberEligibleForDeletion(member, cutoff, bansById, graceMs)) {
      return;
    }

    // Final confirmation: re-fetch member row to ensure they haven't re-joined/changed state
    const fresh = await db
      .select()
      .from(memberTable)
      .where(eq(memberTable.discordId, member.discordId))
      .then((rows) => rows[0]);

    if (!fresh || fresh.currentlyInServer) {
      return;
    }

    // Confirm lastLeftAt hasn't been updated to a more recent time (i.e. rejoin then leave)
    const freshLastLeft = fresh.lastLeftAt
      ? new Date(fresh.lastLeftAt).getTime()
      : 0;
    if (freshLastLeft === 0 || freshLastLeft > cutoff.getTime()) {
      return;
    }

    const idSuffix = member.discordId.slice(-4) ?? 'unknown';

    // All checks passed - delete data
    try {
      await deleteUserLevel(member.discordId);
      await removeAllUserAchievements(member.discordId);
      logger.info(
        `[DataRetention] Deleted level & achievements for user with ID suffix of: ${idSuffix}`
      );
    } catch (error) {
      logger.error(
        `[DataRetention] Failed to delete data for user with ID suffix of: ${idSuffix}`,
        error
      );
    }
  }

  runCleanup().catch((error) => {
    logger.error('[DataRetention] Initial cleanup error', error);
  });

  // Schedule daily cleanup
  setInterval(() => runCleanup(), 24 * 60 * 60 * 1000);

  function groupBansByDiscordId(
    bans: Array<{ discordId: string; expiresAt: Date | null }>
  ) {
    const map = new Map<
      string,
      Array<{ discordId: string; expiresAt: Date | null }>
    >();
    for (const ban of bans) {
      const list = map.get(ban.discordId) ?? [];
      list.push(ban);
      map.set(ban.discordId, list);
    }
    return map;
  }

  function isMemberEligibleForDeletion(
    member: { discordId: string; lastLeftAt: string | Date | null },
    cutoff: Date,
    bansById: Map<string, Array<{ discordId: string; expiresAt: Date | null }>>,
    graceMs: number
  ) {
    const lastLeft = member.lastLeftAt
      ? new Date(member.lastLeftAt).getTime()
      : 0;
    if (lastLeft === 0 || lastLeft > cutoff.getTime()) {
      return false;
    }

    const activeBans = bansById.get(member.discordId) ?? [];
    if (activeBans.length === 0) {
      return true;
    }

    const anyPermanent = activeBans.some((b) => !b.expiresAt);
    if (anyPermanent) {
      return true;
    }

    const maxExpiry = activeBans.reduce((max, ban) => {
      if (!ban.expiresAt) {
        return max;
      }
      const t = new Date(ban.expiresAt).getTime();
      return t > max ? t : max;
    }, 0);

    if (maxExpiry > Date.now()) {
      return false;
    }

    if (Date.now() < maxExpiry + graceMs) {
      return false;
    }

    return true;
  }
}

export default scheduleUserDataRetentionCleanup;
