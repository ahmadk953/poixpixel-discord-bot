import { Collection, GuildMember } from 'discord.js';
import { eq } from 'drizzle-orm';

import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
  withDbRetryDrizzle,
} from '../db.js';
import * as schema from '../schema.js';
import { getMemberModerationHistory } from './moderationFunctions.js';
import { logger } from '@/util/logger.js';

/**
 * Get all non-bot members currently in the server
 * @returns Array of member objects
 */
export async function getAllMembers() {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot get members',
      );
      throw new Error('Database not initialized');
    }

    const cacheKey = 'nonBotMembers';
    return await withCache<schema.memberTableTypes[]>(cacheKey, async () => {
      return await withDbRetryDrizzle(
        async () => {
          return await db
            .select()
            .from(schema.memberTable)
            .where(eq(schema.memberTable.currentlyInServer, true));
        },
        {
          operationName: 'get-all-members',
        },
      );
    });
  } catch (error) {
    return handleDbError('Failed to get all members', error as Error);
  }
}

/**
 * Get detailed information about a specific member including moderation history
 * @param discordId - Discord ID of the user
 * @returns Member object with moderation history
 */
export async function getMember(
  discordId: string,
): Promise<
  | (schema.memberTableTypes & { moderations: schema.moderationTableTypes[] })
  | undefined
> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot get member',
      );
      throw new Error('Database not initialized');
    }

    const member = await withDbRetryDrizzle(
      async () => {
        const [memberData] = await db
          .select()
          .from(schema.memberTable)
          .where(eq(schema.memberTable.discordId, discordId))
          .limit(1);
        return memberData;
      },
      {
        operationName: 'get-member-info',
      },
    );

    if (!member) {
      return undefined;
    }

    const cacheKey = `${discordId}-memberInfo`;

    return await withCache(
      cacheKey,
      async () => {
        const moderations = await getMemberModerationHistory(discordId);

        return {
          ...member,
          moderations,
        };
      },
      300,
    );
  } catch (error) {
    return handleDbError('Failed to get member', error as Error);
  }
}

/**
 * Set or update multiple members at once
 * @param nonBotMembers - Array of member objects
 */
export async function setMembers(
  nonBotMembers: Collection<string, GuildMember>,
): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot set members',
      );
      throw new Error('Database not initialized');
    }

    await Promise.all(
      nonBotMembers.map(async (member) => {
        const memberInfo = await withDbRetryDrizzle(
          async () => {
            return await db
              .select()
              .from(schema.memberTable)
              .where(eq(schema.memberTable.discordId, member.user.id));
          },
          {
            operationName: 'check-existing-member',
          },
        );

        if (memberInfo.length > 0) {
          await updateMember({
            discordId: member.user.id,
            discordUsername: member.user.username,
            currentlyInServer: true,
          });
        } else {
          const members: typeof schema.memberTable.$inferInsert = {
            discordId: member.user.id,
            discordUsername: member.user.username,
          };

          await withDbRetryDrizzle(
            async () => {
              return await db
                .insert(schema.memberTable)
                .values(members)
                .onConflictDoUpdate({
                  target: schema.memberTable.discordId,
                  set: {
                    discordUsername: members.discordUsername,
                    currentlyInServer: true,
                  },
                });
            },
            {
              operationName: 'insert-or-update-member',
              forceRetry: true,
            },
          );
        }
      }),
    );
  } catch (error) {
    handleDbError('Failed to set members', error as Error);
  }
}

/**
 * Update a member's information in the database
 * @param discordId - Discord ID of the user
 * @param discordUsername - New username of the member
 * @param currentlyInServer - Whether the member is currently in the server
 * @param currentlyBanned - Whether the member is currently banned
 */
export async function updateMember({
  discordId,
  discordUsername,
  currentlyInServer,
  currentlyBanned,
  currentlyMuted,
  lastLeftAt,
}: schema.memberTableTypes): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot update member',
      );
      throw new Error('Database not initialized');
    }

    await withDbRetryDrizzle(
      async () => {
        return await db
          .update(schema.memberTable)
          .set({
            discordUsername,
            currentlyInServer,
            currentlyBanned,
            currentlyMuted,
            lastLeftAt,
          })
          .where(eq(schema.memberTable.discordId, discordId));
      },
      {
        operationName: 'update-member',
        forceRetry: true,
      },
    );

    await Promise.all([
      invalidateCache(`${discordId}-memberInfo`),
      invalidateCache('nonBotMembers'),
    ]);
  } catch (error) {
    handleDbError('Failed to update member', error as Error);
  }
}
