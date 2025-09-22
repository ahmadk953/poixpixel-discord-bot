import { loadConfig } from './configLoader.js';
import { db, ensureDbInitialized } from '@/db/db.js';
import * as schema from '@/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { deleteUserLevel } from '@/db/functions/levelFunctions.js';
import { removeAllUserAchievements } from '@/db/functions/achievementFunctions.js';

/**
 * Schedule periodic cleanup of user level/achievement data based on config.
 */
export function scheduleUserDataRetentionCleanup() {
  const config = loadConfig();
  const retentionDays = config.dataRetention?.deleteAfterDays ?? 0;
  const postBanGraceDays = config.dataRetention?.postBanGraceDays ?? 3;

  if (!retentionDays || retentionDays <= 0) {
    console.log('[dataRetention] retention disabled');
    return;
  }

  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const graceMs = postBanGraceDays * 24 * 60 * 60 * 1000;

  const runCleanup = async () => {
    try {
      await ensureDbInitialized();
      if (!db) return;

      const cutoff = new Date(Date.now() - retentionMs);

      // Fetch all members who are recorded as not in-server
      const candidates = await db
        .select()
        .from(schema.memberTable)
        .where(eq(schema.memberTable.currentlyInServer, false));

      if (candidates.length === 0) return;

      // Collect IDs and fetch any active bans for them in one query
      const ids = candidates
        .map((c) => c.discordId)
        .filter(Boolean) as string[];

      const allActiveBans =
        ids.length > 0
          ? await db
              .select()
              .from(schema.moderationTable)
              .where(
                and(
                  eq(schema.moderationTable.action, 'ban'),
                  eq(schema.moderationTable.active, true),
                  inArray(schema.moderationTable.discordId, ids),
                ),
              )
          : [];

      const bansById = new Map<string, (typeof allActiveBans)[0][]>();
      for (const ban of allActiveBans) {
        const list = bansById.get(ban.discordId) ?? [];
        list.push(ban);
        bansById.set(ban.discordId, list);
      }

      for (const m of candidates) {
        const lastLeft = m.lastLeftAt ? new Date(m.lastLeftAt).getTime() : 0;

        // Skip if we don't have a valid last-left timestamp or they left recently
        if (lastLeft === 0 || lastLeft > cutoff.getTime()) continue;

        const activeBans = bansById.get(m.discordId) ?? [];

        // Determine behavior based on ban state:
        // - No active ban => eligible for deletion (subject to re-check below)
        // - Permanent active ban (no expiresAt) => keep until retention period has passed (we've already checked lastLeft against cutoff) -> eligible
        // - Temporary active ban(s) => wait until all expire, then allow grace period after expiry before deletion
        let shouldDelete = false;

        if (activeBans.length === 0) {
          // No active ban -> delete if still not in server
          shouldDelete = true;
        } else {
          // Has at least one active ban
          const anyPermanent = activeBans.some((b) => !b.expiresAt);
          if (anyPermanent) {
            // Permanent ban: delete after retention period (lastLeft already older than cutoff)
            shouldDelete = true;
          } else {
            // Temporary bans: compute latest expiry
            let maxExpiry = 0;
            for (const ban of activeBans) {
              if (ban.expiresAt) {
                const t = new Date(ban.expiresAt).getTime();
                if (t > maxExpiry) maxExpiry = t;
              }
            }

            // If the latest expiry is still in the future, ban is active -> skip
            if (maxExpiry > Date.now()) {
              continue;
            }

            // If we're still within the grace period after expiry, wait
            if (Date.now() < maxExpiry + graceMs) {
              continue;
            }

            // Ban expired and grace period elapsed -> eligible for deletion
            shouldDelete = true;
          }
        }

        if (!shouldDelete) continue;

        // Final confirmation: re-fetch member row to ensure they haven't re-joined/changed state
        const fresh = await db
          .select()
          .from(schema.memberTable)
          .where(eq(schema.memberTable.discordId, m.discordId))
          .then((rows) => rows[0]);

        if (!fresh) {
          // No row found - nothing to do
          continue;
        }

        // If they rejoined, skip deletion
        if (fresh.currentlyInServer) {
          continue;
        }

        // Confirm lastLeftAt hasn't been updated to a more recent time (i.e. rejoin then leave)
        const freshLastLeft = fresh.lastLeftAt
          ? new Date(fresh.lastLeftAt).getTime()
          : 0;
        if (freshLastLeft === 0 || freshLastLeft > cutoff.getTime()) {
          continue;
        }

        // All checks passed - delete data
        try {
          await deleteUserLevel(m.discordId);
          await removeAllUserAchievements(m.discordId);
          console.log(
            `[dataRetention] Deleted level & achievements for ${m.discordId}`,
          );
        } catch (err) {
          console.error(
            '[dataRetention] Failed to delete data for',
            m.discordId,
            err,
          );
        }
      }
    } catch (err) {
      console.error('[dataRetention] cleanup error', err);
    }
  };

  runCleanup().catch(console.error);
  setInterval(() => void runCleanup(), 24 * 60 * 60 * 1000);
}

export default scheduleUserDataRetentionCleanup;
