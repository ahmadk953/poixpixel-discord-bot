import { eq } from 'drizzle-orm';

import { logger } from '@/util/logger.js';
import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
  withDbRetryDrizzle,
} from '../db.js';
import { moderationTable, type moderationTableTypes } from '../schema.js';
import { normalizeModerationDates } from './utils/moderationUtils.js';

/**
 * Add a new moderation action to a member's history
 * @param moderation - Moderation action details, including discordId, moderatorDiscordId, and action
 */
export async function updateMemberModerationHistory(
  moderation: Omit<Partial<moderationTableTypes>, 'id'> & {
    discordId: string;
    moderatorDiscordId: string;
    action: string;
  }
): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[moderationDbFunctions] Database not initialized, update member moderation history'
      );
      throw new Error('Database not initialized');
    }

    const { discordId } = moderation;

    await db.insert(moderationTable).values(moderation);

    await Promise.all([
      invalidateCache(`${discordId}-moderationHistory`),
      invalidateCache(`${discordId}-memberInfo`),
    ]);
  } catch (error) {
    handleDbError('Failed to update moderation history', error as Error);
  }
}

/**
 * Get a member's moderation history
 * @param discordId - Discord ID of the user
 * @returns Array of moderation actions
 */
export async function getMemberModerationHistory(
  discordId: string
): Promise<moderationTableTypes[]> {
  await ensureDbInitialized();

  if (!db) {
    logger.error(
      '[moderationDbFunctions] Database not initialized, cannot get member moderation history'
    );
    throw new Error('Database not initialized');
  }

  const cacheKey = `${discordId}-moderationHistory`;

  try {
    const moderationHistory = await withCache<moderationTableTypes[]>(
      cacheKey,
      async () => {
        return await withDbRetryDrizzle<moderationTableTypes[]>(
          async () => {
            return await db
              .select()
              .from(moderationTable)
              .where(eq(moderationTable.discordId, discordId));
          },
          {
            operationName: 'get-moderation-history',
          }
        );
      }
    );

    return moderationHistory.map(normalizeModerationDates);
  } catch (error) {
    return handleDbError('Failed to get moderation history', error as Error);
  }
}
