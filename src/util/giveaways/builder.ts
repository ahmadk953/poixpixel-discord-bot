import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';

import { GiveawaySession } from './types.js';
import { DEFAULT_REQUIRE_ALL, DEFAULT_WINNER_COUNT } from './constants.js';
import { getSession, saveSession } from './utils.js';
import { logger } from '../logger.js';

/**
 * Handles the start of the giveaway builder.
 * @param interaction The interaction object from the command or button click.
 */
export async function startGiveawayBuilder(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
): Promise<void> {
  await interaction.deferReply({ flags: ['Ephemeral'] });

  const session: GiveawaySession = {
    step: 1,
    winnerCount: DEFAULT_WINNER_COUNT,
    requirements: {
      requireAll: DEFAULT_REQUIRE_ALL,
    },
  };

  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the display of the current step in the giveaway builder.
 * @param interaction The interaction object from the command or button click.
 * @param session The current giveaway session.
 */
export async function showBuilderStep(
  interaction: any,
  session: GiveawaySession,
): Promise<void> {
  if (!interaction.isCommand() && interaction.responded) {
    return;
  }

  try {
    let embed: EmbedBuilder;
    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    switch (session.step) {
      case 1:
        embed = createStep1Embed(session);
        components.push(createStep1Buttons(session));
        break;
      case 2:
        embed = createStep2Embed(session);
        components.push(...createStep2Buttons(session));
        break;
      case 3:
        embed = createStep3Embed(session);
        components.push(...createStep3Buttons(session));
        break;
      case 4:
        embed = createStep4Embed(session);
        components.push(...createStep4Buttons());
        break;
      case 5:
        embed = createStep5Embed(session);
        components.push(...createStep5Buttons());
        break;
      default:
        embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Creation')
          .setDescription('Setting up your giveaway...')
          .setColor(0x3498db);
    }

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ embeds: [embed], components });
    } else {
      await interaction.update({ embeds: [embed], components });
    }
  } catch (error) {
    logger.error(
      '[GiveawayManager] Error displaying giveaway builder step',
      error,
    );
    if (!interaction.replied) {
      try {
        await interaction.reply({
          content: 'There was an error updating the giveaway builder.',
          flags: ['Ephemeral'],
        });
      } catch (replyError) {
        logger.error(
          '[GiveawayManager] Failed to send error reply',
          replyError,
        );
      }
    }
  }
}

/**
 * Handles the next step in the giveaway builder.
 * @param interaction The interaction object from the button click.
 */
export async function nextBuilderStep(
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

  if (session.step === 1) {
    if (!session.prize || !session.endTime) {
      await interaction.reply({
        content: 'Please set both prize and duration before continuing.',
        flags: ['Ephemeral'],
      });
      return;
    }

    if (!(session.endTime instanceof Date)) {
      await interaction.reply({
        content: 'Invalid duration setting. Please set the duration again.',
        flags: ['Ephemeral'],
      });
      return;
    }
  }

  session.step = Math.min(session.step + 1, 5);
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

/**
 * Handles the previous step in the giveaway builder.
 * @param interaction The interaction object from the button click.
 */
export async function previousBuilderStep(
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

  session.step = Math.max(session.step - 1, 1);
  await saveSession(interaction.user.id, session);
  await showBuilderStep(interaction, session);
}

function createStep1Embed(session: GiveawaySession): EmbedBuilder {
  const endTimeValue =
    session.endTime instanceof Date
      ? `${session.duration} (ends <t:${Math.floor(session.endTime.getTime() / 1000)}:R>)`
      : 'Not set';

  return new EmbedBuilder()
    .setTitle(' Giveaway Creation - Step 1/5')
    .setDescription('Set the basic details for your giveaway.')
    .setColor(0x3498db)
    .addFields([
      { name: 'Prize', value: session.prize || 'Not set', inline: true },
      { name: 'Duration', value: endTimeValue, inline: true },
      { name: 'Winners', value: session.winnerCount.toString(), inline: true },
    ]);
}

function createStep1Buttons(
  session: GiveawaySession,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_set_prize')
      .setLabel('Set Prize')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('giveaway_set_duration')
      .setLabel('Set Duration')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('giveaway_set_winners')
      .setLabel('Set Winners')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('giveaway_next')
      .setLabel('Next Step')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!session.prize || !session.endTime),
  );
}

function createStep2Embed(session: GiveawaySession): EmbedBuilder {
  const requirementsList = [];
  if (session.requirements?.level) {
    requirementsList.push(`• Level ${session.requirements.level}+`);
  }
  if (session.requirements?.roleId) {
    requirementsList.push(`• Role <@&${session.requirements.roleId}>`);
  }
  if (session.requirements?.messageCount) {
    requirementsList.push(`• ${session.requirements.messageCount}+ messages`);
  }

  const requirementsText = requirementsList.length
    ? `${session.requirements.requireAll ? 'ALL requirements must be met' : 'ANY ONE requirement must be met'}\n${requirementsList.join('\n')}`
    : 'No requirements set';

  return new EmbedBuilder()
    .setTitle('🎉 Giveaway Creation - Step 2/5')
    .setDescription('Set entry requirements for your giveaway (optional).')
    .setColor(0x3498db)
    .addFields([
      { name: 'Prize', value: session.prize || 'Not set' },
      { name: 'Requirements', value: requirementsText },
    ]);
}

function createStep2Buttons(
  session: GiveawaySession,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_set_requirements')
        .setLabel('Set Requirements')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('giveaway_toggle_logic')
        .setLabel(
          session.requirements.requireAll ? 'Require ANY' : 'Require ALL',
        )
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_previous')
        .setLabel('Previous Step')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('giveaway_next')
        .setLabel('Next Step')
        .setStyle(ButtonStyle.Success),
    ),
  ];
}

function createStep3Embed(session: GiveawaySession): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('🎉 Giveaway Creation - Step 3/5')
    .setDescription('Select Giveaway Channel (optional).')
    .setColor(0x3498db)
    .addFields([
      {
        name: 'Channel',
        value: session.channelId
          ? `<#${session.channelId}>`
          : 'Current Channel',
      },
    ]);

  return embed;
}

function createStep3Buttons(
  session: GiveawaySession,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_set_channel')
        .setLabel(session.channelId ? 'Change Channel' : 'Set Channel')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_previous')
        .setLabel('Previous Step')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('giveaway_next')
        .setLabel('Next Step')
        .setStyle(ButtonStyle.Success),
    ),
  ];
}

function createStep4Embed(session: GiveawaySession): EmbedBuilder {
  const bonusEntries = session.bonusEntries || {};

  const rolesText =
    bonusEntries.roles?.map((r) => `<@&${r.id}>: +${r.entries}`).join('\n') ||
    'None';
  const levelsText =
    bonusEntries.levels
      ?.map((l) => `Level ${l.threshold}+: +${l.entries}`)
      .join('\n') || 'None';
  const messagesText =
    bonusEntries.messages
      ?.map((m) => `${m.threshold}+ messages: +${m.entries}`)
      .join('\n') || 'None';

  return new EmbedBuilder()
    .setTitle('🎉 Giveaway Creation - Step 4/5')
    .setDescription('Configure bonus entries for your giveaway.')
    .setColor(0x3498db)
    .addFields([
      { name: 'Role Bonuses', value: rolesText, inline: true },
      { name: 'Level Bonuses', value: levelsText, inline: true },
      { name: 'Message Bonuses', value: messagesText, inline: true },
    ]);
}

function createStep4Buttons(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_bonus_entries')
        .setLabel('Set Bonus Entries')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_previous')
        .setLabel('Previous Step')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('giveaway_next')
        .setLabel('Next Step')
        .setStyle(ButtonStyle.Success),
    ),
  ];
}

function createStep5Embed(session: GiveawaySession): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎉 Giveaway Creation - Step 5/5')
    .setDescription('Finalize your giveaway settings.')
    .setColor(0x3498db)
    .addFields([
      {
        name: 'Role to Ping',
        value: session.pingRoleId ? `<@&${session.pingRoleId}>` : 'None',
      },
    ]);
}

function createStep5Buttons(): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_set_ping_role')
        .setLabel('Set Ping Role')
        .setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('giveaway_previous')
        .setLabel('Previous Step')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('giveaway_publish')
        .setLabel('Create Giveaway')
        .setStyle(ButtonStyle.Success),
    ),
  ];
}
