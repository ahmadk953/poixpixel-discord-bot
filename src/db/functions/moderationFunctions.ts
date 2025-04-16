import { eq } from 'drizzle-orm';

import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
} from '../db.js';
import * as schema from '../schema.js';

/**
 * Add a new moderation action to a member's history
 * @param discordId - Discord ID of the user
 * @param moderatorDiscordId - Discord ID of the moderator
 * @param action - Type of action taken
 * @param reason - Reason for the action
 * @param duration - Duration of the action
 * @param createdAt - Timestamp of when the action was taken
 * @param expiresAt - Timestamp of when the action expires
 * @param active - Wether the action is active or not
 */
export async function updateMemberModerationHistory({
  discordId,
  moderatorDiscordId,
  action,
  reason,
  duration,
  createdAt,
  expiresAt,
  active,
}: schema.moderationTableTypes): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error(
        'Database not initialized, update member moderation history',
      );
    }

    const moderationEntry = {
      discordId,
      moderatorDiscordId,
      action,
      reason,
      duration,
      createdAt,
      expiresAt,
      active,
    };

    await db.insert(schema.moderationTable).values(moderationEntry);

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
  discordId: string,
): Promise<schema.moderationTableTypes[]> {
  await ensureDbInitialized();

  if (!db) {
    console.error(
      'Database not initialized, cannot get member moderation history',
    );
  }

  const cacheKey = `${discordId}-moderationHistory`;

  try {
    return await withCache<schema.moderationTableTypes[]>(
      cacheKey,
      async () => {
        const history = await db
          .select()
          .from(schema.moderationTable)
          .where(eq(schema.moderationTable.discordId, discordId));
        return history as schema.moderationTableTypes[];
      },
    );
  } catch (error) {
    return handleDbError('Failed to get moderation history', error as Error);
  }
}
