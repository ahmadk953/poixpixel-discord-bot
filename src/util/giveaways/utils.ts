import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
} from 'discord.js';

import { del, getJson, setJson } from '@/db/redis.js';
import { getUserLevel } from '@/db/db.js';
import { GiveawaySession } from './types.js';
import { SESSION_PREFIX, SESSION_TIMEOUT } from './constants.js';
import { showBuilderStep } from './builder.js';

/**
 * Select winners for the giveaway.
 * @param participants - Array of participant IDs
 * @param winnerCount - Number of winners to select
 * @param forceWinners - Array of IDs to force as winners
 * @param excludeIds - Array of IDs to exclude from selection
 * @returns - Array of winner IDs
 */
export function selectGiveawayWinners(
  participants: string[],
  winnerCount: number,
  forceWinners?: string[],
  excludeIds?: string[],
): string[] {
  if (forceWinners?.length) return forceWinners;

  const eligibleParticipants = excludeIds
    ? participants.filter((p) => !excludeIds.includes(p))
    : participants;

  if (!eligibleParticipants.length) return [];

  const uniqueParticipants = [...new Set(eligibleParticipants)];

  const actualWinnerCount = Math.min(winnerCount, uniqueParticipants.length);
  const shuffled = uniqueParticipants.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, actualWinnerCount);
}

/**
 * Format the winner mentions for the giveaway embed.
 * @param winnerIds - Array of winner IDs
 * @returns - Formatted string of winner mentions
 */
export function formatWinnerMentions(winnerIds?: string[]): string {
  return winnerIds?.length
    ? winnerIds.map((id) => `<@${id}>`).join(', ')
    : 'No valid participants';
}

/**
 * Create the giveaway button for users to enter.
 * @returns - ActionRowBuilder with the giveaway button
 */
export function createGiveawayButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('enter_giveaway')
      .setLabel('Enter Giveaway')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎉'),
  );
}

/**
 * Check if the user meets the giveaway requirements.
 * @param interaction - Button interaction from Discord
 * @param giveaway - Giveaway data
 * @returns - Array of failed and met requirements
 */
export async function checkUserRequirements(
  interaction: ButtonInteraction,
  giveaway: any,
): Promise<[string[], string[]]> {
  const requirementsFailed: string[] = [];
  const requirementsMet: string[] = [];

  if (giveaway.requiredLevel) {
    const userData = await getUserLevel(interaction.user.id);
    if (userData.level < giveaway.requiredLevel) {
      requirementsFailed.push(
        `You need to be level ${giveaway.requiredLevel}+ to enter (you're level ${userData.level})`,
      );
    } else {
      requirementsMet.push(`Level requirement met (${userData.level})`);
    }
  }

  if (giveaway.requiredRoleId) {
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    if (!member?.roles.cache.has(giveaway.requiredRoleId)) {
      requirementsFailed.push(
        `You need the <@&${giveaway.requiredRoleId}> role to enter`,
      );
    } else {
      requirementsMet.push('Role requirement met');
    }
  }

  if (giveaway.requiredMessageCount) {
    const userData = await getUserLevel(interaction.user.id);
    if (userData.messagesSent < giveaway.requiredMessageCount) {
      requirementsFailed.push(
        `You need to have sent ${giveaway.requiredMessageCount}+ messages to enter (you've sent ${userData.messagesSent})`,
      );
    } else {
      requirementsMet.push(
        `Message count requirement met (${userData.messagesSent})`,
      );
    }
  }

  return [requirementsFailed, requirementsMet];
}

/**
 * Check if the user has already entered the giveaway.
 * @param interaction - Button interaction from Discord
 * @param giveaway - Giveaway data
 * @returns - Boolean indicating if the user has entered
 */
export async function saveSession(
  userId: string,
  data: GiveawaySession,
): Promise<void> {
  const sessionToStore = {
    ...data,
    endTime: data.endTime?.toISOString(),
  };
  await setJson(`${SESSION_PREFIX}${userId}`, sessionToStore, SESSION_TIMEOUT);
}

/**
 * Get the giveaway session for a user.
 * @param userId - The ID of the user
 * @returns - The user's giveaway session or null if not found
 */
export async function getSession(
  userId: string,
): Promise<GiveawaySession | null> {
  const session = await getJson<GiveawaySession>(`${SESSION_PREFIX}${userId}`);
  if (!session) return null;

  return {
    ...session,
    endTime: session.endTime ? new Date(session.endTime) : undefined,
  };
}

/**
 * Delete the giveaway session for a user.
 * @param userId - The ID of the user
 */
export async function deleteSession(userId: string): Promise<void> {
  await del(`${SESSION_PREFIX}${userId}`);
}

/**
 * Toggle the requirement logic for the giveaway session.
 * @param interaction - Button interaction from Discord
 */
export async function toggleRequirementLogic(
  interaction: ButtonInteraction,
): Promise<void> {
  const session = await getSession(interaction.user.id);
  if (!session) {
    await interaction.reply({
      content: 'Your giveaway session has expired. Please start over.',
      flags: ['Ephemeral'],
    });
    return;
  }

  session.requirements.requireAll = !session.requirements.requireAll;
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Parse the role bonus entries from a string input.
 * @param input - String input in the format "roleId:entries,roleId:entries"
 * @returns - Array of objects containing role ID and entries
 */
export function parseRoleBonusEntries(
  input: string,
): Array<{ id: string; entries: number }> {
  if (!input.trim()) return [];

  return input
    .split(',')
    .map((entry) => entry.trim().split(':'))
    .filter(([key, value]) => key && value)
    .map(([key, value]) => ({
      id: key,
      entries: Number(value) || 0,
    }));
}

/**
 * Parse the level bonus entries from a string input.
 * @param input - String input in the format "level:entries,level:entries"
 * @returns - Array of objects containing level and entries
 */
export function parseThresholdBonusEntries(
  input: string,
): Array<{ threshold: number; entries: number }> {
  if (!input.trim()) return [];

  return input
    .split(',')
    .map((entry) => entry.trim().split(':'))
    .filter(([key, value]) => key && value)
    .map(([key, value]) => ({
      threshold: Number(key) || 0,
      entries: Number(value) || 0,
    }));
}
