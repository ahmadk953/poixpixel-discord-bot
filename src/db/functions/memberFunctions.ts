import type { Collection, GuildMember } from 'discord.js';
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
import {
  memberTable,
  type memberTableTypes,
  type moderationTableTypes,
} from '../schema.js';
import { getMemberModerationHistory } from './moderationFunctions.js';
import { normalizeModerationDates } from './utils/moderationUtils.js';

/**
 * Get all non-bot members currently in the server
 * @returns Array of member objects
 */
export async function getAllMembers() {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot get members'
      );
      throw new Error('Database not initialized');
    }

    const cacheKey = 'nonBotMembers';
    return await withCache<memberTableTypes[]>(
      cacheKey,
      async () =>
        await withDbRetryDrizzle(
          async () =>
            await db
              .select()
              .from(memberTable)
              .where(eq(memberTable.currentlyInServer, true)),
          {
            operationName: 'get-all-members',
          }
        )
    );
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
  discordId: string
): Promise<
  (memberTableTypes & { moderations: moderationTableTypes[] }) | undefined
> {
  const normalizeMemberModerations = (
    data:
      | (memberTableTypes & {
          moderations: moderationTableTypes[];
        })
      | undefined
  ) => {
    if (!data) {
      return;
    }
    const moderations = Array.isArray(data.moderations)
      ? data.moderations.map(normalizeModerationDates)
      : [];
    return { ...data, moderations } as typeof data;
  };

  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot get member'
      );
      throw new Error('Database not initialized');
    }

    const member = await withDbRetryDrizzle(
      async () => {
        const [memberData] = await db
          .select()
          .from(memberTable)
          .where(eq(memberTable.discordId, discordId))
          .limit(1);
        return memberData;
      },
      {
        operationName: 'get-member-info',
      }
    );

    if (!member) {
      return;
    }

    const cacheKey = `memberInfo:${discordId}`;

    const cachedMember = await withCache(
      cacheKey,
      async () => {
        const moderations: moderationTableTypes[] =
          await getMemberModerationHistory(discordId).catch(
            (error: unknown) => {
              logger.error(
                '[memberDbFunctions] Failed to get member moderation history',
                error
              );

              if (
                error instanceof Error &&
                error.message.includes('Database not initialized')
              ) {
                throw new Error(
                  `Failed to get moderation history for ${discordId}: ${error.message}`
                );
              }

              return [];
            }
          );

        return {
          ...member,
          moderations,
        };
      },
      300
    );

    return normalizeMemberModerations(cachedMember);
  } catch (error) {
    return handleDbError('Failed to get member', error as Error);
  }
}

/**
 * Set or update multiple members at once
 * @param nonBotMembers - Array of member objects
 */
export async function setMembers(
  nonBotMembers: Collection<string, GuildMember>
): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot set members'
      );
      throw new Error('Database not initialized');
    }

    await Promise.all(
      nonBotMembers.map(async (member) => {
        const memberInfo = await withDbRetryDrizzle(
          async () =>
            await db
              .select()
              .from(memberTable)
              .where(eq(memberTable.discordId, member.user.id)),
          {
            operationName: 'check-existing-member',
          }
        );

        if (memberInfo.length > 0) {
          await updateMember({
            discordId: member.user.id,
            discordUsername: member.user.username,
            currentlyInServer: true,
          });
        } else {
          const members: typeof memberTable.$inferInsert = {
            discordId: member.user.id,
            discordUsername: member.user.username,
          };

          await withDbRetryDrizzle(
            async () =>
              await db
                .insert(memberTable)
                .values(members)
                .onConflictDoUpdate({
                  target: memberTable.discordId,
                  set: {
                    discordUsername: members.discordUsername,
                    currentlyInServer: true,
                  },
                }),
            {
              operationName: 'insert-or-update-member',
              forceRetry: true,
            }
          );
        }
      })
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
export async function updateMember(
  updates: Partial<Omit<memberTableTypes, 'id'>> & { discordId: string }
): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[memberDbFunctions] Database not initialized, cannot update member'
      );
      throw new Error('Database not initialized');
    }

    const { discordId, ...updateFields } = updates;

    if (Object.keys(updateFields).length === 0) {
      return;
    }

    await withDbRetryDrizzle(
      async () =>
        await db
          .update(memberTable)
          .set(updateFields)
          .where(eq(memberTable.discordId, discordId)),
      {
        operationName: 'update-member',
        forceRetry: true,
      }
    );

    await Promise.all([
      invalidateCache(`memberInfo:${discordId}`),
      invalidateCache('nonBotMembers'),
    ]);
  } catch (error) {
    handleDbError('Failed to update member', error as Error);
  }
}
