import {
  type ButtonInteraction,
  type Client,
  EmbedBuilder,
  type TextChannel,
} from 'discord.js';

import { createGiveaway, endGiveaway, getActiveGiveaways } from '@/db/db.js';
import { loadConfig } from '../configLoader.js';
import { logger } from '../logger.js';
import type { GiveawayEmbedParams } from './types.js';
import {
  createGiveawayButtons,
  deleteSession,
  formatWinnerMentions as formatWinnerMentionsInternal,
  getSession,
} from './utils.js';

function getRequirementsText(params: GiveawayEmbedParams): string | null {
  const requirements: string[] = [];

  if (params.requiredLevel) {
    requirements.push(`• Level ${params.requiredLevel}+ required`);
  }

  if (params.requiredRoleId) {
    requirements.push(`• <@&${params.requiredRoleId}> role required`);
  }

  if (params.requiredMessageCount) {
    requirements.push(`• ${params.requiredMessageCount}+ messages required`);
  }

  if (!requirements.length) {
    return null;
  }

  return requirements.join('\n');
}

function getBonusEntriesText(params: GiveawayEmbedParams): string | null {
  const bonusDetails: string[] = [];

  for (const roleBonus of params.bonusEntries?.roles ?? []) {
    bonusDetails.push(`• <@&${roleBonus.id}>: +${roleBonus.entries} entries`);
  }

  for (const levelBonus of params.bonusEntries?.levels ?? []) {
    bonusDetails.push(
      `• Level ${levelBonus.threshold}+: +${levelBonus.entries} entries`
    );
  }

  for (const messageBonus of params.bonusEntries?.messages ?? []) {
    bonusDetails.push(
      `• ${messageBonus.threshold}+ messages: +${messageBonus.entries} entries`
    );
  }

  if (!bonusDetails.length) {
    return null;
  }

  return bonusDetails.join('\n');
}

function applyEndedGiveawayEmbedDetails(
  embed: EmbedBuilder,
  params: GiveawayEmbedParams
): void {
  embed.addFields(
    {
      name: 'Winner(s)',
      value: formatWinnerMentionsInternal(params.winnersIds ?? undefined),
    },
    { name: 'Hosted by', value: `<@${params.hostId}>` }
  );

  embed.setFooter({ text: params.footerText ?? 'Ended at' });
  embed.setTimestamp();
}

function applyActiveGiveawayEmbedDetails(
  embed: EmbedBuilder,
  params: GiveawayEmbedParams
): void {
  embed.addFields(
    {
      name: 'Winner(s)',
      value: (params.winnerCount ?? 1).toString(),
      inline: true,
    },
    {
      name: 'Entries',
      value: (params.participantCount ?? 0).toString(),
      inline: true,
    },
    {
      name: 'Ends at',
      value: params.endTime
        ? `<t:${Math.floor(params.endTime.getTime() / 1000)}:R>`
        : 'Soon',
      inline: true,
    },
    { name: 'Hosted by', value: `<@${params.hostId}>` }
  );

  const requirementsText = getRequirementsText(params);
  if (requirementsText) {
    embed.addFields({
      name: `📋 Entry Requirements (${(params.requireAllCriteria ?? true) ? 'ALL required' : 'ANY one required'})`,
      value: requirementsText,
    });
  }

  const bonusEntriesText = getBonusEntriesText(params);
  if (bonusEntriesText) {
    embed.addFields({
      name: '✨ Bonus Entries',
      value: bonusEntriesText,
    });
  }

  embed.setFooter({ text: 'End time' });
  if (params.endTime) {
    embed.setTimestamp(params.endTime);
  }
}

/**
 * Creates a Discord embed for a giveaway based on the provided parameters.
 * Handles both active and ended giveaway states.
 *
 * @param params - The parameters needed to build the giveaway embed.
 * @returns A configured EmbedBuilder instance for the giveaway.
 */
export function createGiveawayEmbed(params: GiveawayEmbedParams): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(params.isEnded ? '🎉 Giveaway Ended 🎉' : '🎉 Giveaway 🎉')
    .setDescription(
      `**Prize**: ${params.prize}${params.id ? `\n**Giveaway ID**: ${params.id}` : ''}`
    )
    .setColor(params.isEnded ? 0xff_00_00 : 0x00_ff_00);

  if (params.isEnded) {
    applyEndedGiveawayEmbedDetails(embed, params);
    return embed;
  }

  applyActiveGiveawayEmbedDetails(embed, params);
  return embed;
}

/**
 * Processes a giveaway that has ended. Fetches the ended giveaway data,
 * updates the original message, announces the winners (if any), and handles errors.
 *
 * @param client - The Discord Client instance.
 * @param messageId - The message ID of the giveaway to process.
 */
export async function processEndedGiveaway(
  client: Client,
  messageId: string
): Promise<void> {
  try {
    const endedGiveaway = await endGiveaway(messageId);
    if (!endedGiveaway) {
      logger.warn(
        `[GiveawayManager] Attempted to process non-existent or already ended giveaway: ${messageId}`
      );
      return;
    }

    const config = loadConfig();
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      logger.error(`[GiveawayManager] Guild ${config.guildId} not found.`);
      return;
    }

    const channel = guild.channels.cache.get(endedGiveaway.channelId);
    if (!channel?.isTextBased()) {
      logger.warn(
        `[GiveawayManager] Giveaway channel ${endedGiveaway.channelId} not found or not text-based.`
      );
      return;
    }

    try {
      const giveawayMessage = await channel.messages.fetch(messageId);
      if (!giveawayMessage) {
        logger.warn(
          `[GiveawayManager] Giveaway message ${messageId} not found in channel ${channel.id}.`
        );
        return;
      }

      await giveawayMessage.edit({
        embeds: [
          createGiveawayEmbed({
            id: endedGiveaway.id,
            prize: endedGiveaway.prize,
            hostId: endedGiveaway.hostId,
            winnersIds: endedGiveaway.winnersIds ?? [],
            isEnded: true,
          }),
        ],
        components: [],
      });

      if (endedGiveaway.winnersIds?.length) {
        const winnerMentions = formatWinnerMentionsInternal(
          endedGiveaway.winnersIds
        );
        await channel.send({
          content: `Congratulations ${winnerMentions}! You won **${endedGiveaway.prize}**!`,
          allowedMentions: { users: endedGiveaway.winnersIds },
        });
      } else {
        await channel.send(
          `No one entered the giveaway for **${endedGiveaway.prize}**!`
        );
      }
    } catch (error) {
      logger.error(
        `[GiveawayManager] Error updating giveaway message ${messageId}`,
        error
      );
    }
  } catch (error) {
    logger.error(
      `[GiveawayManager] Error processing ended giveaway ${messageId}`,
      error
    );
  }
}

/**
 * Schedules all active giveaways fetched from the database to end at their designated time.
 * If a giveaway's end time is already past, it processes it immediately.
 * This function should be called on bot startup.
 *
 * @param client - The Discord Client instance.
 */
export async function scheduleGiveaways(client: Client): Promise<void> {
  try {
    const activeGiveaways = await getActiveGiveaways();
    logger.info(
      `[GiveawayManager] Found ${activeGiveaways.length} active giveaways to schedule.`
    );

    for (const giveaway of activeGiveaways) {
      const endTime = giveaway.endAt.getTime();
      const now = Date.now();
      const timeLeft = endTime - now;

      if (timeLeft <= 0) {
        logger.info(
          `[GiveawayManager] Giveaway ID ${giveaway.id} end time has passed. Processing now.`
        );
        await processEndedGiveaway(client, giveaway.messageId);
      } else {
        logger.info(
          `[GiveawayManager] Scheduling giveaway ID ${giveaway.id} to end in ${Math.floor(timeLeft / 1000)} seconds.`
        );
        setTimeout(() => {
          processEndedGiveaway(client, giveaway.messageId);
        }, timeLeft);
      }
    }
    logger.info('[GiveawayManager] Finished scheduling active giveaways.');
  } catch (error) {
    logger.error('[GiveawayManager] Error scheduling giveaways', error);
  }
}

/**
 * Publishes a giveaway based on the session data associated with the interacting user.
 * Sends the giveaway message to the designated channel, saves it to the database,
 * schedules its end, and cleans up the user's session.
 *
 * @param interaction - The button interaction triggering the publish action.
 */
export async function publishGiveaway(
  interaction: ButtonInteraction
): Promise<void> {
  await interaction.deferUpdate();
  const session = await getSession(interaction.user.id);

  if (!session) {
    await interaction.followUp({
      content: 'Your giveaway session has expired. Please start over.',
      flags: ['Ephemeral'],
    });
    return;
  }

  if (!(session.prize && session.endTime)) {
    await interaction.followUp({
      content: 'Missing required information. Please complete all steps.',
      flags: ['Ephemeral'],
    });
    return;
  }

  try {
    const channelId = session.channelId ?? interaction.channelId;
    const channel = await interaction.guild?.channels.fetch(channelId);
    if (!channel?.isTextBased()) {
      await interaction.followUp({
        content: 'Invalid channel selected.',
        flags: ['Ephemeral'],
      });
      return;
    }

    const pingContent = session.pingRoleId ? `<@&${session.pingRoleId}>` : '';

    const initialEmbed = createGiveawayEmbed({
      prize: session.prize,
      endTime: session.endTime,
      winnerCount: session.winnerCount,
      hostId: interaction.user.id,
      participantCount: 0,
      requiredLevel: session.requirements?.level,
      requiredRoleId: session.requirements?.roleId,
      requiredMessageCount: session.requirements?.messageCount,
      requireAllCriteria: session.requirements.requireAll,
      bonusEntries: session.bonusEntries,
    });

    const giveawayMessage = await (channel as TextChannel).send({
      content: pingContent,
      embeds: [initialEmbed],
      components: [createGiveawayButtons()],
      allowedMentions: {
        roles: session.pingRoleId ? [session.pingRoleId] : [],
      },
    });

    const createdGiveaway = await createGiveaway({
      channelId: channel.id,
      messageId: giveawayMessage.id,
      endAt: session.endTime,
      prize: session.prize,
      winnerCount: session.winnerCount,
      hostId: interaction.user.id,
      requirements: {
        level: session.requirements?.level,
        roleId: session.requirements?.roleId,
        messageCount: session.requirements?.messageCount,
        requireAll: session.requirements.requireAll,
      },
      bonuses: session.bonusEntries,
    });

    const updatedEmbed = createGiveawayEmbed({
      id: createdGiveaway.id,
      prize: session.prize,
      endTime: session.endTime,
      winnerCount: session.winnerCount,
      hostId: interaction.user.id,
      participantCount: 0,
      requiredLevel: session.requirements?.level,
      requiredRoleId: session.requirements?.roleId,
      requiredMessageCount: session.requirements?.messageCount,
      requireAllCriteria: session.requirements.requireAll,
      bonusEntries: session.bonusEntries,
    });

    await giveawayMessage.edit({
      embeds: [updatedEmbed],
      components: [createGiveawayButtons()],
    });

    const timeLeft = session.endTime.getTime() - Date.now();
    setTimeout(() => {
      processEndedGiveaway(interaction.client, giveawayMessage.id);
    }, timeLeft);

    await interaction.editReply({
      content: `✅ Giveaway created successfully in <#${channel.id}>!\nIt will end <t:${Math.floor(session.endTime.getTime() / 1000)}:R>`,
      components: [],
      embeds: [],
    });

    await deleteSession(interaction.user.id);
  } catch (error) {
    logger.error('[GiveawayManager] Error publishing giveaway', error);
    await interaction.followUp({
      content:
        'An error occurred while creating the giveaway. Please try again.',
      flags: ['Ephemeral'],
    });
  }
}

// biome-ignore lint/performance/noBarrelFile: This file serves as the main export point for giveaway-related functionality, including the manager and utility functions. It is intentionally structured as a barrel file for better organization and ease of imports throughout the codebase.
export * as builder from './builder.js';
export * as dropdowns from './dropdowns.js';
export * as handlers from './handlers.js';
export * as modals from './modals.js';
export {
  formatWinnerMentions,
  selectGiveawayWinners,
  toggleRequirementLogic,
} from './utils.js';
