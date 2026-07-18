import type {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { addGiveawayParticipant, getGiveaway, getUserLevel } from '@/db/db.js';
import { parseDuration } from '../helpers.js';
import { logger } from '../logger.js';
import { showBuilderStep } from './builder.js';
import { createGiveawayEmbed } from './giveawayManager.js';
import { showCustomDurationModal } from './modals.js';
import type { GiveawaySession } from './types.js';
import {
  checkUserRequirements,
  createGiveawayButtons,
  getSession,
  parseRoleBonusEntries,
  parseThresholdBonusEntries,
  saveSession,
} from './utils.js';

type GiveawayRecord = NonNullable<Awaited<ReturnType<typeof getGiveaway>>>;
type BuilderInteraction = ModalSubmitInteraction | StringSelectMenuInteraction;

async function replySessionExpired(
  interaction: BuilderInteraction
): Promise<void> {
  await interaction.reply({
    content: 'Your giveaway session has expired. Please start over.',
    flags: ['Ephemeral'],
  });
}

async function getSessionOrReplyExpired(
  interaction: BuilderInteraction
): Promise<GiveawaySession | null> {
  const session = await getSession(interaction.user.id);
  if (!session) {
    await replySessionExpired(interaction);
    return null;
  }

  return session;
}

// ========================
// Button Handlers
// ========================

/**
 * Calculates total bonus entries based on user data and giveaway bonuses.
 */
async function calculateTotalEntries(
  interaction: ButtonInteraction,
  giveaway: GiveawayRecord
): Promise<number> {
  const userData = await getUserLevel(interaction.user.id);
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  let totalEntries = 1;

  for (const roleBonus of giveaway.bonusEntries?.roles ?? []) {
    if (member?.roles.cache.has(roleBonus.id)) {
      totalEntries += roleBonus.entries;
    }
  }

  for (const levelBonus of giveaway.bonusEntries?.levels ?? []) {
    if (userData.level >= levelBonus.threshold) {
      totalEntries += levelBonus.entries;
    }
  }

  for (const messageBonus of giveaway.bonusEntries?.messages ?? []) {
    if (userData.messagesSent >= messageBonus.threshold) {
      totalEntries += messageBonus.entries;
    }
  }

  return totalEntries;
}

/**
 * Validates user requirements and handles failure responses.
 */
async function validateAndRespondRequirements(
  interaction: ButtonInteraction,
  giveaway: GiveawayRecord
): Promise<boolean> {
  const [requirementsFailed, requirementsMet] = await checkUserRequirements(
    interaction,
    giveaway
  );
  const requireAll = giveaway.requireAllCriteria ?? true;
  const totalRequirements = [
    giveaway.requiredLevel,
    giveaway.requiredRoleId,
    giveaway.requiredMessageCount,
  ].filter(Boolean).length;

  if (
    (requireAll && requirementsFailed.length) ||
    (!requireAll && totalRequirements > 0 && !requirementsMet.length)
  ) {
    const reqType = requireAll ? 'ALL' : 'ANY ONE';
    await interaction.followUp({
      content: `You don't meet the requirements to enter this giveaway (${reqType} required):\n${requirementsFailed.join('\n')}`,
      flags: ['Ephemeral'],
    });
    return false;
  }

  return true;
}

/**
 * Handles the entry for a giveaway.
 * @param interaction - The interaction object from the button click
 */
export async function handleGiveawayEntry(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const messageId = interaction.message.id;
    const giveaway = await getGiveaway(messageId);

    if (giveaway?.status !== 'active') {
      await interaction.followUp({
        content: 'This giveaway has ended or does not exist.',
        flags: ['Ephemeral'],
      });
      return;
    }

    const meetsRequirements = await validateAndRespondRequirements(
      interaction,
      giveaway
    );
    if (!meetsRequirements) {
      return;
    }

    const totalEntries = await calculateTotalEntries(interaction, giveaway);

    const addResult = await addGiveawayParticipant(
      messageId,
      interaction.user.id,
      totalEntries
    );

    if (addResult === 'already_entered') {
      await interaction.followUp({
        content: 'You have already entered this giveaway!',
        flags: ['Ephemeral'],
      });
      return;
    }

    if (addResult === 'inactive') {
      await interaction.followUp({
        content: 'This giveaway is no longer active.',
        flags: ['Ephemeral'],
      });
      return;
    }

    if (addResult === 'error') {
      await interaction.followUp({
        content: 'An error occurred while trying to enter the giveaway.',
        flags: ['Ephemeral'],
      });
      return;
    }

    const updatedGiveaway = await getGiveaway(messageId);
    if (!updatedGiveaway) {
      logger.error(
        `[GiveawayManager] Failed to fetch giveaway ${messageId} after successful entry.`
      );
      await interaction.followUp({
        content: `🎉 You have entered the giveaway with ${totalEntries} entries! Good luck! (Failed to update embed)`,
        flags: ['Ephemeral'],
      });
      return;
    }

    const embed = createGiveawayEmbed({
      id: updatedGiveaway.id,
      prize: updatedGiveaway.prize,
      endTime: updatedGiveaway.endAt,
      winnerCount: updatedGiveaway.winnerCount,
      hostId: updatedGiveaway.hostId,
      participantCount: updatedGiveaway.participants?.length ?? 0,
      requiredLevel: updatedGiveaway.requiredLevel ?? undefined,
      requiredRoleId: updatedGiveaway.requiredRoleId ?? undefined,
      requiredMessageCount: updatedGiveaway.requiredMessageCount ?? undefined,
      requireAllCriteria: updatedGiveaway.requireAllCriteria ?? undefined,
      bonusEntries: updatedGiveaway.bonusEntries,
    });

    await interaction.message.edit({
      embeds: [embed],
      components: [createGiveawayButtons()],
    });

    await interaction.followUp({
      content: `🎉 You have entered the giveaway with **${totalEntries}** entries! Good luck!`,
      flags: ['Ephemeral'],
    });
  } catch (error) {
    logger.error('[GiveawayManager] Error handling giveaway entry', error);
    throw error;
  }
}

// ========================
// Dropdown Handlers
// ========================

/**
 * Handles the duration selection for the giveaway.
 * @param interaction - The interaction object from the dropdown selection
 */
export async function handleDurationSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const duration = interaction.values[0];

  if (duration === 'custom') {
    await showCustomDurationModal(interaction);
    return;
  }

  const session = await getSessionOrReplyExpired(interaction);
  if (!session) {
    return;
  }

  const durationMs = parseDuration(duration);
  if (durationMs) {
    session.duration = duration;
    session.endTime = new Date(Date.now() + durationMs);
    await saveSession(interaction.user.id, session);
  }

  await showBuilderStep(interaction, session);
}

/**
 * Handles the winner selection for the giveaway.
 * @param interaction - The interaction object from the dropdown selection
 */
export async function handleWinnerSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const winnerCount = Number.parseInt(interaction.values[0], 10);
  const session = await getSessionOrReplyExpired(interaction);

  if (!session) {
    return;
  }

  session.winnerCount = winnerCount;
  await saveSession(interaction.user.id, session);

  await showBuilderStep(interaction, session);
}

/**
 * Handles the channel selection for the giveaway.
 * @param interaction - The interaction object from the dropdown selection
 */
export async function handleChannelSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  try {
    const channelId = interaction.values[0];
    const session = await getSessionOrReplyExpired(interaction);

    if (!session) {
      return;
    }

    session.channelId = channelId;
    await saveSession(interaction.user.id, session);

    if (interaction.replied || interaction.deferred) {
      await showBuilderStep(interaction, session);
    } else {
      await interaction.deferUpdate();
      await showBuilderStep(interaction, session);
    }
  } catch (error) {
    logger.error('[GiveawayManager] Error in handleChannelSelect', error);
    if (!interaction.replied) {
      await interaction
        .reply({
          content: 'An error occurred while processing your selection.',
          flags: ['Ephemeral'],
        })
        .catch((err) => {
          logger.error(
            '[GiveawayManager] Failed to send error reply in handleChannelSelect',
            err
          );
        });
    }
  }
}

/**
 * Handles the requirements selection for the giveaway.
 * @param interaction - The interaction object from the dropdown selection
 */
export async function handlePingRoleSelect(
  interaction: StringSelectMenuInteraction
): Promise<void> {
  const roleId = interaction.values[0];
  const session = await getSession(interaction.user.id);

  if (!session) {
    return;
  }

  session.pingRoleId = roleId;
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

// ========================
// Modal Handlers
// ========================

/**
 * Handles the prize input for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handlePrizeSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const prize = interaction.fields.getTextInputValue('prize_input');
  const session = await getSessionOrReplyExpired(interaction);

  if (!session) {
    return;
  }

  session.prize = prize;
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the custom duration input for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handleCustomDurationSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const customDuration = interaction.fields.getTextInputValue('duration_input');
  const session = await getSessionOrReplyExpired(interaction);

  if (!session) {
    return;
  }

  const durationMs = parseDuration(customDuration);
  if (!durationMs || durationMs <= 0) {
    await interaction.reply({
      content: 'Invalid duration format. Please use formats like 1d, 12h, 30m.',
      flags: ['Ephemeral'],
    });
    return;
  }

  session.duration = customDuration;
  session.endTime = new Date(Date.now() + durationMs);
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the requirements submission for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handleRequirementsSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const levelStr = interaction.fields.getTextInputValue('level_input');
  const messageStr = interaction.fields.getTextInputValue('message_input');
  const roleStr = interaction.fields.getTextInputValue('role_input');
  const session = await getSessionOrReplyExpired(interaction);

  if (!session) {
    return;
  }

  if (levelStr.trim()) {
    const level = Number.parseInt(levelStr, 10);
    if (!Number.isNaN(level) && level > 0) {
      session.requirements.level = level;
    } else {
      session.requirements.level = undefined;
    }
  } else {
    session.requirements.level = undefined;
  }

  if (messageStr.trim()) {
    const messages = Number.parseInt(messageStr, 10);
    if (!Number.isNaN(messages) && messages > 0) {
      session.requirements.messageCount = messages;
    } else {
      session.requirements.messageCount = undefined;
    }
  } else {
    session.requirements.messageCount = undefined;
  }

  if (roleStr.trim()) {
    const roleId = roleStr.replace(/\D/g, '');
    if (roleId) {
      session.requirements.roleId = roleId;
    } else {
      session.requirements.roleId = undefined;
    }
  } else {
    session.requirements.roleId = undefined;
  }

  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the bonus entries submission for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handleBonusEntriesSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const session = await getSessionOrReplyExpired(interaction);
  if (!session) {
    return;
  }

  const rolesStr = interaction.fields.getTextInputValue('roles_input');
  const levelsStr = interaction.fields.getTextInputValue('levels_input');
  const messagesStr = interaction.fields.getTextInputValue('messages_input');

  session.bonusEntries = {
    roles: parseRoleBonusEntries(rolesStr),
    levels: parseThresholdBonusEntries(levelsStr),
    messages: parseThresholdBonusEntries(messagesStr),
  };

  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the ping role ID submission for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handlePingRoleIdSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const roleId = interaction.fields
    .getTextInputValue('role_input')
    .replace(/\D/g, '');
  const session = await getSessionOrReplyExpired(interaction);

  if (!session) {
    return;
  }

  session.pingRoleId = roleId || undefined;
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the channel ID submission for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handleChannelIdSubmit(
  interaction: ModalSubmitInteraction
): Promise<void> {
  const channelId = interaction.fields
    .getTextInputValue('channel_input')
    .replace(/\D/g, '');
  const session = await getSessionOrReplyExpired(interaction);

  if (!session) {
    return;
  }

  session.channelId = channelId || undefined;
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}
