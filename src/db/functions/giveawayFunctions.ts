import { eq } from 'drizzle-orm';

import {
  db,
  ensureDbInitialized,
  handleDbError,
  withDbRetryDrizzle,
} from '../db.js';
import { selectGiveawayWinners } from '@/util/giveaways/utils.js';
import * as schema from '../schema.js';
import { logger } from '@/util/logger.js';

/**
 * Create a giveaway in the database
 * @param giveawayData - Data for the giveaway
 * @returns Created giveaway object
 */
export async function createGiveaway(giveawayData: {
  channelId: string;
  messageId: string;
  endAt: Date;
  prize: string;
  winnerCount: number;
  hostId: string;
  requirements?: {
    level?: number;
    roleId?: string;
    messageCount?: number;
    requireAll?: boolean;
  };
  bonuses?: {
    roles?: Array<{ id: string; entries: number }>;
    levels?: Array<{ threshold: number; entries: number }>;
    messages?: Array<{ threshold: number; entries: number }>;
  };
}): Promise<schema.giveawayTableTypes> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[giveawayDbFunctions] Database not initialized, cannot create giveaway',
      );
      throw new Error('Database not initialized');
    }

    const [giveaway] = await db
      .insert(schema.giveawayTable)
      .values({
        channelId: giveawayData.channelId,
        messageId: giveawayData.messageId,
        endAt: giveawayData.endAt,
        prize: giveawayData.prize,
        winnerCount: giveawayData.winnerCount,
        hostId: giveawayData.hostId,
        requiredLevel: giveawayData.requirements?.level,
        requiredRoleId: giveawayData.requirements?.roleId,
        requiredMessageCount: giveawayData.requirements?.messageCount,
        requireAllCriteria: giveawayData.requirements?.requireAll ?? true,
        bonusEntries:
          giveawayData.bonuses as schema.giveawayTableTypes['bonusEntries'],
      })
      .returning();

    return giveaway as schema.giveawayTableTypes;
  } catch (error) {
    return handleDbError('Failed to create giveaway', error as Error);
  }
}

/**
 * Get a giveaway by ID or message ID
 * @param id - ID of the giveaway
 * @param isDbId - Whether the ID is a database ID
 * @returns Giveaway object or undefined if not found
 */
export async function getGiveaway(
  id: string | number,
  isDbId = false,
): Promise<schema.giveawayTableTypes | undefined> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[giveawayDbFunctions] Database not initialized, cannot get giveaway',
      );
      throw new Error('Database not initialized');
    }

    if (isDbId) {
      const numId = typeof id === 'string' ? parseInt(id) : id;
      const [giveaway] = await withDbRetryDrizzle(
        async () => {
          return await db
            .select()
            .from(schema.giveawayTable)
            .where(eq(schema.giveawayTable.id, numId))
            .limit(1);
        },
        {
          operationName: 'get-giveaway-by-db-id',
        },
      );

      return giveaway as schema.giveawayTableTypes;
    } else {
      const [giveaway] = await withDbRetryDrizzle(
        async () => {
          return await db
            .select()
            .from(schema.giveawayTable)
            .where(eq(schema.giveawayTable.messageId, id as string))
            .limit(1);
        },
        {
          operationName: 'get-giveaway-by-message-id',
        },
      );

      return giveaway as schema.giveawayTableTypes;
    }
  } catch (error) {
    return handleDbError('Failed to get giveaway', error as Error);
  }
}

/**
 * Get all active giveaways
 * @returns Array of active giveaway objects
 */
export async function getActiveGiveaways(): Promise<
  schema.giveawayTableTypes[]
> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[giveawayDbFunctions] Database not initialized, cannot get active giveaways',
      );
      throw new Error('Database not initialized');
    }

    return await withDbRetryDrizzle(
      async () => {
        return (await db
          .select()
          .from(schema.giveawayTable)
          .where(
            eq(schema.giveawayTable.status, 'active'),
          )) as schema.giveawayTableTypes[];
      },
      {
        operationName: 'get-active-giveaways',
      },
    );
  } catch (error) {
    return handleDbError('Failed to get active giveaways', error as Error);
  }
}

/**
 * Update giveaway participants
 * @param messageId - ID of the giveaway message
 * @param userId - ID of the user to add
 * @param entries - Number of entries to add
 * @return 'success' | 'already_entered' | 'inactive' | 'error'
 */
export async function addGiveawayParticipant(
  messageId: string,
  userId: string,
  entries = 1,
): Promise<'success' | 'already_entered' | 'inactive' | 'error'> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[giveawayDbFunctions] Database not initialized, cannot add participant',
      );
      throw new Error('Database not initialized');
    }

    const giveaway = await getGiveaway(messageId);
    if (!giveaway || giveaway.status !== 'active') {
      return 'inactive';
    }

    if (giveaway.participants?.includes(userId)) {
      return 'already_entered';
    }

    const participants = [...(giveaway.participants || [])];
    for (let i = 0; i < entries; i++) {
      participants.push(userId);
    }

    await db
      .update(schema.giveawayTable)
      .set({ participants: participants })
      .where(eq(schema.giveawayTable.messageId, messageId));

    return 'success';
  } catch (error) {
    handleDbError('Failed to add giveaway participant', error as Error);
    return 'error';
  }
}

/**
 * End a giveaway
 * @param id - ID of the giveaway
 * @param isDbId - Whether the ID is a database ID
 * @param forceWinners - Array of user IDs to force as winners
 * @return Updated giveaway object
 */
export async function endGiveaway(
  id: string | number,
  isDbId = false,
  forceWinners?: string[],
): Promise<schema.giveawayTableTypes | undefined> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[giveawayDbFunctions] Database not initialized, cannot end giveaway',
      );
      throw new Error('Database not initialized');
    }

    const giveaway = await getGiveaway(id, isDbId);
    if (!giveaway || giveaway.status !== 'active' || !giveaway.participants) {
      return undefined;
    }

    const winners = selectGiveawayWinners(
      giveaway.participants,
      giveaway.winnerCount,
      forceWinners,
    );

    const [updatedGiveaway] = await db
      .update(schema.giveawayTable)
      .set({
        status: 'ended',
        winnersIds: winners,
      })
      .where(eq(schema.giveawayTable.id, giveaway.id))
      .returning();

    return updatedGiveaway as schema.giveawayTableTypes;
  } catch (error) {
    return handleDbError('Failed to end giveaway', error as Error);
  }
}

/**
 * Reroll winners for a giveaway
 * @param id - ID of the giveaway
 * @return Updated giveaway object
 */
export async function rerollGiveaway(
  id: string,
): Promise<schema.giveawayTableTypes | undefined> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[giveawayDbFunctions] Database not initialized, cannot reroll giveaway',
      );
      throw new Error('Database not initialized');
    }

    const giveaway = await getGiveaway(id, true);
    if (
      !giveaway ||
      !giveaway.participants ||
      giveaway.participants.length === 0 ||
      giveaway.status !== 'ended'
    ) {
      logger.warn(
        `[giveawayDbFunctions] Cannot reroll giveaway ${id}: Not found, no participants, or not ended.`,
      );
      return undefined;
    }

    const newWinners = selectGiveawayWinners(
      giveaway.participants,
      giveaway.winnerCount,
      undefined,
      giveaway.winnersIds ?? [],
    );

    if (newWinners.length === 0) {
      logger.warn(
        `[giveawayDbFunctions] Cannot reroll giveaway ${id}: No eligible participants left after excluding previous winners.`,
      );
      return giveaway;
    }

    const [updatedGiveaway] = await db
      .update(schema.giveawayTable)
      .set({
        winnersIds: newWinners,
      })
      .where(eq(schema.giveawayTable.id, giveaway.id))
      .returning();

    return updatedGiveaway as schema.giveawayTableTypes;
  } catch (error) {
    return handleDbError('Failed to reroll giveaway', error as Error);
  }
}
