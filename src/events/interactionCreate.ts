import { Events } from 'discord.js';
import type {
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import type { Event } from '@/types/EventTypes.js';
import { approveFact, deleteFact } from '@/db/db.js';
import * as GiveawayManager from '@/util/giveaways/giveawayManager.js';
import type { ExtendedClient } from '@/structures/ExtendedClient.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { processCommandAchievements } from '@/util/achievementManager.js';
import { logger } from '@/util/logger.js';

export default {
  name: Events.InteractionCreate,
  execute: async (interaction: Interaction) => {
    if (!(await validateInteraction(interaction))) return;

    try {
      if (interaction.isCommand()) {
        await handleCommand(interaction);
      } else if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await handleSelectMenu(interaction);
      } else {
        logger.debug('[InteractionCreate] Unhandled interaction type', {
          type: interaction.type,
          channelId: interaction.channelId,
        });
      }
    } catch (error) {
      handleInteractionError(error, interaction);
    }
  },
} as Event<typeof Events.InteractionCreate>;

/**
 * Normalize thrown values into an Error while preserving the original value.
 * @param context A brief description of where the error occurred.
 * @param error The error to normalize.
 * @returns A normalized Error object.
 */
function normalizeError(context: string, error: unknown): Error {
  if (error instanceof Error) return error;
  const message = `${context}: ${String(error)}`;
  const err = new Error(message, {
    cause: error as unknown as Error | undefined,
  });
  (err as unknown as Record<string, unknown>).original = error;
  return err;
}

/**
 * Handles command interactions.
 * @param interaction The interaction to handle.
 */
async function handleCommand(interaction: Interaction) {
  if (!interaction.isCommand()) return;

  const client = interaction.client as ExtendedClient;
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    logger.error(
      `[InteractionCreate] No command matching ${interaction.commandName} was found.`,
    );
    return;
  }

  if (interaction.isChatInputCommand()) {
    if (!interaction.guild) {
      logger.warn(
        '[InteractionCreate] Received chat input command outside of a guild',
        {
          commandName: interaction.commandName,
          userId: interaction.user.id,
        },
      );
      return;
    }

    const { guild } = interaction;
    await command.execute(interaction);
    await processCommandAchievements(
      interaction.user.id,
      command.data.name,
      guild,
    );
  } else if (
    interaction.isUserContextMenuCommand() ||
    interaction.isMessageContextMenuCommand()
  ) {
    if (!interaction.guild) {
      logger.warn(
        '[InteractionCreate] Received context menu command outside of a guild',
        {
          commandName: interaction.commandName,
          userId: interaction.user.id,
        },
      );
      return;
    }

    const { guild } = interaction;
    // @ts-expect-error Context menu commands have different interaction types but share execute method
    await command.execute(interaction);
    await processCommandAchievements(
      interaction.user.id,
      command.data.name,
      guild,
    );
  }
}

/**
 * Handles button interactions.
 * @param interaction The interaction to handle.
 */
async function handleButton(interaction: Interaction) {
  if (!interaction.isButton()) return;

  const { customId } = interaction;

  try {
    const giveawayHandlers: Record<
      string,
      (buttonInteraction: ButtonInteraction) => Promise<void>
    > = {
      giveaway_start_builder: GiveawayManager.builder.startGiveawayBuilder,
      giveaway_next: GiveawayManager.builder.nextBuilderStep,
      giveaway_previous: GiveawayManager.builder.previousBuilderStep,
      giveaway_set_prize: GiveawayManager.modals.showPrizeModal,
      giveaway_set_duration: GiveawayManager.dropdowns.showDurationSelect,
      giveaway_set_winners: GiveawayManager.dropdowns.showWinnerSelect,
      giveaway_set_requirements: GiveawayManager.modals.showRequirementsModal,
      giveaway_toggle_logic: GiveawayManager.toggleRequirementLogic,
      giveaway_set_channel:
        (interaction.guild?.channels.cache.size ?? 0) > 25
          ? GiveawayManager.modals.showChannelSelectModal
          : GiveawayManager.dropdowns.showChannelSelect,
      giveaway_bonus_entries: GiveawayManager.modals.showBonusEntriesModal,
      giveaway_set_ping_role:
        (interaction.guild?.roles.cache.size ?? 0) > 25
          ? GiveawayManager.modals.showPingRoleSelectModal
          : GiveawayManager.dropdowns.showPingRoleSelect,
      giveaway_publish: GiveawayManager.publishGiveaway,
      enter_giveaway: GiveawayManager.handlers.handleGiveawayEntry,
    };

    if (giveawayHandlers[customId]) {
      await giveawayHandlers[customId](interaction);
      return;
    }

    if (
      customId.startsWith('approve_fact_') ||
      customId.startsWith('reject_fact_')
    ) {
      await handleFactModeration(interaction, customId);
      return;
    }

    logger.debug('[InteractionCreate] Unhandled button interaction', {
      customId,
      channelId: interaction.channelId,
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw normalizeError('Button interaction failed', error);
  }
}

/**
 * Handles fact moderation interactions.
 * @param interaction The interaction to handle.
 * @param customId The custom ID of the button that was clicked.
 */
async function handleFactModeration(
  interaction: Interaction,
  customId: string,
) {
  if (!interaction.isButton()) return;
  if (!interaction.memberPermissions?.has('ModerateMembers')) {
    await interaction.reply({
      content: 'You do not have permission to moderate facts.',
      flags: ['Ephemeral'],
    });
    return;
  }

  const factId = Number.parseInt(
    customId.replace(/^(approve|reject)_fact_/, ''),
    10,
  );
  if (Number.isNaN(factId)) {
    await interaction.reply({
      content: 'Invalid fact identifier.',
      flags: ['Ephemeral'],
    });
    return;
  }

  const isApproval = customId.startsWith('approve_fact_');

  if (isApproval) {
    await approveFact(factId);
    await interaction.update({
      content: `✅ Fact #${factId} has been approved by <@${interaction.user.id}>`,
      components: [],
    });
  } else {
    await deleteFact(factId);
    await interaction.update({
      content: `❌ Fact #${factId} has been rejected by <@${interaction.user.id}>`,
      components: [],
    });
  }
}

/**
 * Handles modal interactions.
 * @param interaction The interaction to handle.
 */
async function handleModal(interaction: Interaction) {
  if (!interaction.isModalSubmit()) return;

  const { customId } = interaction;
  const modalHandlers: Record<
    string,
    (modalInteraction: ModalSubmitInteraction) => Promise<void>
  > = {
    giveaway_prize_modal: GiveawayManager.handlers.handlePrizeSubmit,
    giveaway_custom_duration:
      GiveawayManager.handlers.handleCustomDurationSubmit,
    giveaway_requirements_modal:
      GiveawayManager.handlers.handleRequirementsSubmit,
    giveaway_bonus_entries_modal:
      GiveawayManager.handlers.handleBonusEntriesSubmit,
    giveaway_ping_role_id_modal:
      GiveawayManager.handlers.handlePingRoleIdSubmit,
    giveaway_channel_id_modal: GiveawayManager.handlers.handleChannelIdSubmit,
  };

  try {
    if (modalHandlers[customId]) {
      await modalHandlers[customId](interaction);
    } else {
      logger.debug(
        '[InteractionCreate] Unhandled modal submission interaction',
        {
          customId,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
        },
      );
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw normalizeError('Modal submission failed', error);
  }
}

/**
 * Handles select menu interactions.
 * @param interaction The interaction to handle.
 */
async function handleSelectMenu(interaction: Interaction) {
  if (!interaction.isStringSelectMenu()) return;

  const { customId } = interaction;
  const selectHandlers: Record<
    string,
    (selectInteraction: StringSelectMenuInteraction) => Promise<void>
  > = {
    giveaway_duration_select: GiveawayManager.handlers.handleDurationSelect,
    giveaway_winners_select: GiveawayManager.handlers.handleWinnerSelect,
    giveaway_channel_select: GiveawayManager.handlers.handleChannelSelect,
    giveaway_ping_role_select: GiveawayManager.handlers.handlePingRoleSelect,
  };

  try {
    if (selectHandlers[customId]) {
      await selectHandlers[customId](interaction);
    } else {
      logger.debug(
        '[InteractionCreate] Unhandled string select menu interaction',
        {
          customId,
          channelId: interaction.channelId,
        },
      );
    }
  } catch (error) {
    if (error instanceof Error) throw error;
    throw normalizeError('Select menu interaction failed', error);
  }
}

/**
 * Handles errors that occur during interaction processing.
 * @param error The error that occurred.
 * @param interaction The interaction that caused the error.
 */
function handleInteractionError(error: unknown, interaction: Interaction) {
  logger.error('[InteractionCreate] Interaction handling error', {
    error,
    stack: (error as Error).stack,
    interactionType: interaction.type,
    channelId: interaction.channelId,
    commandName: interaction.isCommand() ? interaction.commandName : undefined,
    customId:
      interaction.isButton() ||
      interaction.isModalSubmit() ||
      interaction.isAnySelectMenu()
        ? interaction.customId
        : undefined,
  });

  const isUnknownInteractionError =
    (error as { code?: number })?.code === 10062 ||
    String(error).includes('Unknown interaction');

  if (isUnknownInteractionError) {
    logger.warn(
      '[InteractionCreate] Interaction expired before response could be sent (code 10062)',
    );
    return;
  }

  const errorMessage = 'An error occurred while processing your request.';
  safelyRespond(interaction, errorMessage).catch((err) => {
    logger.error(
      '[InteractionCreate] Failed to send error response to interaction',
      err,
    );
  });
}
