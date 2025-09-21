import { loadConfig } from './configLoader.js';
import { db, ensureDbInitialized } from '@/db/db.js';
import * as schema from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
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

      const candidates = await db
        .select()
        .from(schema.memberTable)
        .where(eq(schema.memberTable.currentlyInServer, false));

      for (const m of candidates) {
        const lastLeft = m.lastLeftAt ? new Date(m.lastLeftAt).getTime() : 0;
        if (lastLeft === 0 || lastLeft > cutoff.getTime()) continue;

        const activeBans = await db
          .select()
          .from(schema.moderationTable)
          .where(
            and(
              eq(schema.moderationTable.discordId, m.discordId),
              eq(schema.moderationTable.action, 'ban'),
              eq(schema.moderationTable.active, true),
            ),
          );

        const hasFutureExpiryBan = activeBans.some(
          (ban) =>
            ban.expiresAt && new Date(ban.expiresAt).getTime() > Date.now(),
        );
        if (hasFutureExpiryBan) continue;

        let maxExpiry = 0;
        for (const ban of activeBans) {
          if (ban.expiresAt && new Date(ban.expiresAt).getTime() > maxExpiry) {
            maxExpiry = new Date(ban.expiresAt).getTime();
          }
        }
        if (maxExpiry > 0 && Date.now() < maxExpiry + graceMs) {
          continue;
        }

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
