import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildTextBasedChannel,
  type Message,
} from 'discord.js';

import type { OptionsCommand } from '@/types/CommandTypes.js';
import { logger } from '@/util/logger.js';
import {
  parseDuration,
  validateInteraction,
  safelyRespond,
} from '@/util/helpers.js';
import logAction from '@/util/logging/logAction.js';
import type { PurgeLogAction } from '@/util/logging/types.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addStringOption((option) =>
      option
        .setName('age_limit')
        .setDescription(
          'Delete messages newer than this (e.g., 7d, 14d, max: 14d)',
        )
        .setRequired(false),
    )
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for purging messages')
        .setRequired(false),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    if (!(await validateInteraction(interaction))) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const { guild, channel } = interaction;
      const amount = interaction.options.getInteger('amount', true);
      const targetUser = interaction.options.getUser('user');
      const ageLimitInput = interaction.options.getString('age_limit');
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';
      const moderator = await guild.members.fetch(interaction.user.id);

      // Parse age limit (default to 14 days, max 14 days per Discord API)
      let ageLimitMs: number;
      let ageLimitStr: string;

      if (ageLimitInput) {
        try {
          ageLimitMs = parseDuration(ageLimitInput);
          ageLimitStr = ageLimitInput;

          // Discord API limitation: messages older than 14 days cannot be bulk deleted
          const maxAgeMs = 14 * 24 * 60 * 60 * 1000;
          if (ageLimitMs > maxAgeMs) {
            await safelyRespond(
              interaction,
              '⚠️ Age limit cannot exceed 14 days (Discord API limitation). Using 14 days instead.',
            );
            ageLimitMs = maxAgeMs;
            ageLimitStr = '14d';
          }
        } catch (_error) {
          await safelyRespond(
            interaction,
            'Invalid age limit format. Please use format like: 7d, 14d, 12h, etc.',
          );
          return;
        }
      } else {
        // Default to 14 days
        ageLimitMs = 14 * 24 * 60 * 60 * 1000;
        ageLimitStr = '14d';
      }

      // Validate channel type
      if (
        !channel?.isTextBased() ||
        channel.isDMBased() ||
        !('name' in channel)
      ) {
        await safelyRespond(
          interaction,
          'This command can only be used in guild text channels.',
        );
        return;
      }

      // Type guard: after this point, channel is a guild text-based channel
      const guildChannel = channel as GuildTextBasedChannel;

      // Check bot permissions
      const botMember = await guild.members.fetch(interaction.client.user.id);
      const channelPermissions = guildChannel.permissionsFor(botMember);

      if (
        !channelPermissions?.has(PermissionFlagsBits.ManageMessages) ||
        !channelPermissions?.has(PermissionFlagsBits.ReadMessageHistory)
      ) {
        await safelyRespond(
          interaction,
          'I do not have permission to manage messages or read message history in this channel.',
        );
        return;
      }

      // Fetch messages
      let messagesToDelete: Message[] = [];
      try {
        const fetchedMessages = await guildChannel.messages.fetch({
          limit: 100,
        });

        if (targetUser) {
          // Filter by user
          messagesToDelete = Array.from(fetchedMessages.values())
            .filter((msg) => msg.author.id === targetUser.id)
            .slice(0, amount);
        } else {
          messagesToDelete = Array.from(fetchedMessages.values()).slice(
            0,
            amount,
          );
        }

        if (messagesToDelete.length === 0) {
          await safelyRespond(
            interaction,
            targetUser
              ? `No messages found from ${targetUser.tag} in the last 100 messages.`
              : 'No messages found to delete.',
          );
          return;
        }
      } catch (error) {
        logger.error('[PurgeCommand] Failed to fetch messages', error);
        await safelyRespond(
          interaction,
          'Failed to fetch messages from this channel.',
        );
        return;
      }

      // Filter messages by age
      const ageCutoff = Date.now() - ageLimitMs;
      const deletableMessages = messagesToDelete.filter(
        (msg) => msg.createdTimestamp > ageCutoff,
      );

      const tooOldCount = messagesToDelete.length - deletableMessages.length;

      if (deletableMessages.length === 0) {
        await safelyRespond(
          interaction,
          `All selected messages are older than ${ageLimitStr} and cannot be deleted.`,
        );
        return;
      }

      // Perform bulk delete
      let deletedCount = 0;
      let deletedObject;
      try {
        // bulkDelete returns a Collection of deleted messages
        // filterOld parameter will filter messages older than 14 days automatically
        const deleted = await guildChannel.bulkDelete(deletableMessages, true);
        deletedCount = deleted.size;
        deletedObject = deleted;
      } catch (error) {
        logger.error('[PurgeCommand] Failed to bulk delete messages', error);
        await safelyRespond(
          interaction,
          'Failed to delete messages. Please try again.',
        );
        return;
      }

      // Log the purge action to audit channel via central logAction
      try {
        await logAction({
          guild,
          action: 'purge',
          channel: guildChannel,
          moderator,
          deletedMessages: Array.from(deletedObject.values()),
          skippedCount: tooOldCount,
          targetUser: targetUser ?? undefined,
          reason,
          ageLimit: ageLimitStr,
        } as PurgeLogAction);
      } catch (error) {
        logger.error('[PurgeCommand] Failed to log purge action', error);
      }

      // Send success response
      let responseContent = `Successfully deleted ${deletedCount} message${deletedCount !== 1 ? 's' : ''}`;
      if (targetUser) {
        responseContent += ` from ${targetUser.tag}`;
      }
      if (tooOldCount > 0) {
        responseContent += `\n⚠️ ${tooOldCount} message${tooOldCount !== 1 ? 's were' : ' was'} skipped (older than ${ageLimitStr})`;
      }
      responseContent += '.';

      await safelyRespond(interaction, responseContent);
    } catch (error) {
      logger.error('[PurgeCommand] Error executing purge command', error);
      await safelyRespond(
        interaction,
        'An error occurred while purging messages.',
      );
    }
  },
};

export default command;
