import {
  ButtonInteraction,
  Client,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';

import { createGiveaway, endGiveaway, getActiveGiveaways } from '@/db/db.js';
import { GiveawayEmbedParams } from './types.js';
import {
  createGiveawayButtons,
  deleteSession,
  formatWinnerMentions,
  getSession,
  toggleRequirementLogic,
  selectGiveawayWinners,
} from './utils.js';
import { loadConfig } from '../configLoader.js';
import * as builder from './builder.js';
import * as dropdowns from './dropdowns.js';
import * as handlers from './handlers.js';
import * as modals from './modals.js';

/**
 * Creates a Discord embed for a giveaway based on the provided parameters.
 * Handles both active and ended giveaway states.
 *
 * @param params - The parameters needed to build the giveaway embed.
 * @returns A configured EmbedBuilder instance for the giveaway.
 */
export function createGiveawayEmbed(params: GiveawayEmbedParams): EmbedBuilder {
  const {
    id,
    prize,
    endTime,
    winnerCount = 1,
    hostId,
    participantCount = 0,
    winnersIds,
    isEnded = false,
    footerText,
    requiredLevel,
    requiredRoleId,
    requiredMessageCount,
    requireAllCriteria = true,
    bonusEntries,
  } = params;

  const embed = new EmbedBuilder()
    .setTitle(isEnded ? '🎉 Giveaway Ended 🎉' : '🎉 Giveaway 🎉')
    .setDescription(
      `**Prize**: ${prize}${id ? `\n**Giveaway ID**: ${id}` : ''}`,
    )
    .setColor(isEnded ? 0xff0000 : 0x00ff00);

  if (isEnded) {
    embed.addFields(
      { name: 'Winner(s)', value: formatWinnerMentions(winnersIds) },
      { name: 'Hosted by', value: `<@${hostId}>` },
    );
    embed.setFooter({ text: footerText || 'Ended at' });
    embed.setTimestamp();
  } else {
    embed.addFields(
      { name: 'Winner(s)', value: winnerCount.toString(), inline: true },
      { name: 'Entries', value: participantCount.toString(), inline: true },
      {
        name: 'Ends at',
        value: endTime
          ? `<t:${Math.floor(endTime.getTime() / 1000)}:R>`
          : 'Soon',
        inline: true,
      },
      { name: 'Hosted by', value: `<@${hostId}>` },
    );

    const requirements: string[] = [];
    if (requiredLevel) requirements.push(`• Level ${requiredLevel}+ required`);
    if (requiredRoleId) {
      requirements.push(`• <@&${requiredRoleId}> role required`);
    }
    if (requiredMessageCount) {
      requirements.push(`• ${requiredMessageCount}+ messages required`);
    }

    if (requirements.length) {
      embed.addFields({
        name: `📋 Entry Requirements (${requireAllCriteria ? 'ALL required' : 'ANY one required'})`,
        value: requirements.join('\n'),
      });
    }

    const bonusDetails: string[] = [];
    bonusEntries?.roles?.forEach((r) =>
      bonusDetails.push(`• <@&${r.id}>: +${r.entries} entries`),
    );
    bonusEntries?.levels?.forEach((l) =>
      bonusDetails.push(`• Level ${l.threshold}+: +${l.entries} entries`),
    );
    bonusEntries?.messages?.forEach((m) =>
      bonusDetails.push(`• ${m.threshold}+ messages: +${m.entries} entries`),
    );

    if (bonusDetails.length) {
      embed.addFields({
        name: '✨ Bonus Entries',
        value: bonusDetails.join('\n'),
      });
    }

    embed.setFooter({ text: 'End time' });
    if (endTime) embed.setTimestamp(endTime);
  }

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
  messageId: string,
): Promise<void> {
  try {
    const endedGiveaway = await endGiveaway(messageId);
    if (!endedGiveaway) {
      console.warn(
        `Attempted to process non-existent or already ended giveaway: ${messageId}`,
      );
      return;
    }

    const config = loadConfig();
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error(`Guild ${config.guildId} not found.`);
      return;
    }

    const channel = guild.channels.cache.get(endedGiveaway.channelId);
    if (!channel?.isTextBased()) {
      console.warn(
        `Giveaway channel ${endedGiveaway.channelId} not found or not text-based.`,
      );
      return;
    }

    try {
      const giveawayMessage = await channel.messages.fetch(messageId);
      if (!giveawayMessage) {
        console.warn(
          `Giveaway message ${messageId} not found in channel ${channel.id}.`,
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
        const winnerMentions = formatWinnerMentions(endedGiveaway.winnersIds);
        await channel.send({
          content: `Congratulations ${winnerMentions}! You won **${endedGiveaway.prize}**!`,
          allowedMentions: { users: endedGiveaway.winnersIds },
        });
      } else {
        await channel.send(
          `No one entered the giveaway for **${endedGiveaway.prize}**!`,
        );
      }
    } catch (error) {
      console.error(`Error updating giveaway message ${messageId}:`, error);
    }
  } catch (error) {
    console.error(`Error processing ended giveaway ${messageId}:`, error);
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
    console.log(
      `Found ${activeGiveaways.length} active giveaways to schedule.`,
    );

    for (const giveaway of activeGiveaways) {
      const endTime = giveaway.endAt.getTime();
      const now = Date.now();
      const timeLeft = endTime - now;

      if (timeLeft <= 0) {
        console.log(
          `Giveaway ID ${giveaway.id} end time has passed. Processing now.`,
        );
        await processEndedGiveaway(client, giveaway.messageId);
      } else {
        console.log(
          `Scheduling giveaway ID ${giveaway.id} to end in ${Math.floor(timeLeft / 1000)} seconds.`,
        );
        setTimeout(() => {
          processEndedGiveaway(client, giveaway.messageId);
        }, timeLeft);
      }
    }
    console.log('Finished scheduling active giveaways.');
  } catch (error) {
    console.error('Error scheduling giveaways:', error);
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
  interaction: ButtonInteraction,
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

  if (!session.prize || !session.endTime) {
    await interaction.followUp({
      content: 'Missing required information. Please complete all steps.',
      flags: ['Ephemeral'],
    });
    return;
  }

  try {
    const channelId = session.channelId || interaction.channelId;
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
    console.error('Error publishing giveaway:', error);
    await interaction.followUp({
      content:
        'An error occurred while creating the giveaway. Please try again.',
      flags: ['Ephemeral'],
    });
  }
}

export {
  builder,
  dropdowns,
  handlers,
  modals,
  toggleRequirementLogic,
  formatWinnerMentions,
  selectGiveawayWinners,
};
