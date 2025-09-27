import {
  Events,
  Interaction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';

import { Event } from '@/types/EventTypes.js';
import { approveFact, deleteFact } from '@/db/db.js';
import * as GiveawayManager from '@/util/giveaways/giveawayManager.js';
import { ExtendedClient } from '@/structures/ExtendedClient.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { processCommandAchievements } from '@/util/achievementManager.js';

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
        console.warn('Unhandled interaction type:', interaction);
      }
    } catch (error) {
      handleInteractionError(error, interaction);
    }
  },
} as Event<typeof Events.InteractionCreate>;

async function handleCommand(interaction: Interaction) {
  if (!interaction.isCommand()) return;

  const client = interaction.client as ExtendedClient;
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  if (interaction.isChatInputCommand()) {
    await command.execute(interaction);
    await processCommandAchievements(
      interaction.user.id,
      command.data.name,
      interaction.guild!,
    );
  } else if (
    interaction.isUserContextMenuCommand() ||
    interaction.isMessageContextMenuCommand()
  ) {
    // @ts-expect-error
    await command.execute(interaction);
    await processCommandAchievements(
      interaction.user.id,
      command.data.name,
      interaction.guild!,
    );
  }
}

async function handleButton(interaction: Interaction) {
  if (!interaction.isButton()) return;

  const { customId } = interaction;

  try {
    const giveawayHandlers: Record<
      string,
      (_buttonInteraction: ButtonInteraction) => Promise<void>
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

    console.warn('Unhandled button interaction:', customId);
  } catch (error) {
    throw new Error(`Button interaction failed: ${error}`);
  }
}

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

  const factId = parseInt(customId.replace(/^(approve|reject)_fact_/, ''), 10);
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
      console.warn('Unhandled modal submission interaction:', customId);
    }
  } catch (error) {
    throw new Error(`Modal submission failed: ${error}`);
  }
}

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
      console.warn('Unhandled string select menu interaction:', customId);
    }
  } catch (error) {
    throw new Error(`Select menu interaction failed: ${error}`);
  }
}

function handleInteractionError(error: unknown, interaction: Interaction) {
  console.error('Interaction error:', error);

  const isUnknownInteractionError =
    (error as { code?: number })?.code === 10062 ||
    String(error).includes('Unknown interaction');

  if (isUnknownInteractionError) {
    console.warn(
      'Interaction expired before response could be sent (code 10062)',
    );
    return;
  }

  const errorMessage = 'An error occurred while processing your request.';
  safelyRespond(interaction, errorMessage).catch(console.error);
}
