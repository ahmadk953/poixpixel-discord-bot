import {
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { addGiveawayParticipant, getGiveaway, getUserLevel } from '@/db/db.js';
import { createGiveawayEmbed } from './giveawayManager.js';
import {
  checkUserRequirements,
  createGiveawayButtons,
  getSession,
  parseRoleBonusEntries,
  parseThresholdBonusEntries,
  saveSession,
} from './utils.js';
import { parseDuration } from '../helpers.js';
import { showCustomDurationModal } from './modals.js';
import { showBuilderStep } from './builder.js';

// ========================
// Button Handlers
// ========================

/**
 * Handles the entry for a giveaway.
 * @param interaction - The interaction object from the button click
 */
export async function handleGiveawayEntry(
  interaction: ButtonInteraction,
): Promise<void> {
  await interaction.deferUpdate();

  try {
    const messageId = interaction.message.id;
    const giveaway = await getGiveaway(messageId);

    if (!giveaway || giveaway.status !== 'active') {
      await interaction.followUp({
        content: 'This giveaway has ended or does not exist.',
        flags: ['Ephemeral'],
      });
      return;
    }

    const [requirementsFailed, requirementsMet] = await checkUserRequirements(
      interaction,
      giveaway,
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
      return;
    }

    const userData = await getUserLevel(interaction.user.id);
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    let totalEntries = 1;

    giveaway.bonusEntries?.roles?.forEach((bonus) => {
      if (member?.roles.cache.has(bonus.id)) {
        totalEntries += bonus.entries;
      }
    });

    giveaway.bonusEntries?.levels?.forEach((bonus) => {
      if (userData.level >= bonus.threshold) {
        totalEntries += bonus.entries;
      }
    });

    giveaway.bonusEntries?.messages?.forEach((bonus) => {
      if (userData.messagesSent >= bonus.threshold) {
        totalEntries += bonus.entries;
      }
    });

    const addResult = await addGiveawayParticipant(
      messageId,
      interaction.user.id,
      totalEntries,
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
      console.error(
        `Failed to fetch giveaway ${messageId} after successful entry.`,
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
      participantCount: updatedGiveaway.participants?.length || 0,
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
    console.error('Error handling giveaway entry:', error);
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
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const duration = interaction.values[0];

  if (duration === 'custom') {
    showCustomDurationModal(interaction);
    return;
  }

  const session = await getSession(interaction.user.id);
  if (!session) {
    await interaction.reply({
      content: 'Your giveaway session has expired. Please start over.',
      flags: ['Ephemeral'],
    });
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
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const winnerCount = parseInt(interaction.values[0]);
  const session = await getSession(interaction.user.id);

  if (!session) {
    await interaction.reply({
      content: 'Your giveaway session has expired. Please start over.',
      flags: ['Ephemeral'],
    });
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
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  try {
    const channelId = interaction.values[0];
    const session = await getSession(interaction.user.id);

    if (!session) {
      await interaction.reply({
        content: 'Your giveaway session has expired. Please start over.',
        flags: ['Ephemeral'],
      });
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
    console.error('Error in handleChannelSelect:', error);
    if (!interaction.replied) {
      await interaction
        .reply({
          content: 'An error occurred while processing your selection.',
          flags: ['Ephemeral'],
        })
        .catch(console.error);
    }
  }
}

/**
 * Handles the requirements selection for the giveaway.
 * @param interaction - The interaction object from the dropdown selection
 */
export async function handlePingRoleSelect(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const roleId = interaction.values[0];
  const session = await getSession(interaction.user.id);

  if (!session) return;

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
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const prize = interaction.fields.getTextInputValue('prize_input');
  const session = await getSession(interaction.user.id);

  if (!session) {
    await interaction.reply({
      content: 'Your giveaway session has expired. Please start over.',
      flags: ['Ephemeral'],
    });
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
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const customDuration = interaction.fields.getTextInputValue('duration_input');
  const session = await getSession(interaction.user.id);

  if (!session) {
    await interaction.reply({
      content: 'Your giveaway session has expired. Please start over.',
      flags: ['Ephemeral'],
    });
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
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const levelStr = interaction.fields.getTextInputValue('level_input');
  const messageStr = interaction.fields.getTextInputValue('message_input');
  const roleStr = interaction.fields.getTextInputValue('role_input');
  const session = await getSession(interaction.user.id);

  if (!session) {
    await interaction.reply({
      content: 'Your giveaway session has expired. Please start over.',
      flags: ['Ephemeral'],
    });
    return;
  }

  if (levelStr.trim()) {
    const level = parseInt(levelStr);
    if (!isNaN(level) && level > 0) {
      session.requirements.level = level;
    } else {
      delete session.requirements.level;
    }
  } else {
    delete session.requirements.level;
  }

  if (messageStr.trim()) {
    const messages = parseInt(messageStr);
    if (!isNaN(messages) && messages > 0) {
      session.requirements.messageCount = messages;
    } else {
      delete session.requirements.messageCount;
    }
  } else {
    delete session.requirements.messageCount;
  }

  if (roleStr.trim()) {
    const roleId = roleStr.replace(/\D/g, '');
    if (roleId) {
      session.requirements.roleId = roleId;
    } else {
      delete session.requirements.roleId;
    }
  }

  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the bonus entries submission for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handleBonusEntriesSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const session = await getSession(interaction.user.id);
  if (!session) return;

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
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const roleId = interaction.fields.getTextInputValue('role_input');
  const session = await getSession(interaction.user.id);

  if (!session) return;

  session.pingRoleId = roleId;
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the channel ID submission for the giveaway.
 * @param interaction - The interaction object from the modal submission
 */
export async function handleChannelIdSubmit(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  const channelId = interaction.fields.getTextInputValue('channel_input');
  const session = await getSession(interaction.user.id);

  if (!session) return;

  session.channelId = channelId;
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}
