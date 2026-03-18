import {
  type GuildTextBasedChannel,
  Message,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextBasedChannel,
} from 'discord.js';

import type { OptionsCommand } from '@/types/CommandTypes.js';
import {
  parseDuration,
  safelyRespond,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';
import type { PurgeLogAction } from '@/util/logging/types.js';

const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

async function determineAgeLimit(
  interaction: Parameters<OptionsCommand['execute']>[0],
  ageLimitInput: string | null
): Promise<{ ageLimitMs: number; ageLimitStr: string } | null> {
  if (!ageLimitInput) {
    return { ageLimitMs: MAX_AGE_MS, ageLimitStr: '14d' };
  }

  try {
    const ageLimitMs = parseDuration(ageLimitInput);

    if (ageLimitMs > MAX_AGE_MS) {
      await safelyRespond(
        interaction,
        '⚠️ Age limit cannot exceed 14 days (Discord API limitation). Using 14 days instead.'
      );
      return { ageLimitMs: MAX_AGE_MS, ageLimitStr: '14d' };
    }

    return { ageLimitMs, ageLimitStr: ageLimitInput };
  } catch {
    await safelyRespond(
      interaction,
      'Invalid age limit format. Please use format like: 7d, 14d, 12h, etc.'
    );
    return null;
  }
}

function ensureGuildTextChannel(
  interaction: Parameters<OptionsCommand['execute']>[0],
  channel: TextBasedChannel | null
): GuildTextBasedChannel | null {
  if (!channel?.isTextBased() || channel.isDMBased() || !('name' in channel)) {
    safelyRespond(
      interaction,
      'This command can only be used in guild text channels.'
    );
    return null;
  }

  return channel as GuildTextBasedChannel;
}

async function ensureBotHasPermissions(
  interaction: Parameters<OptionsCommand['execute']>[0],
  guildChannel: GuildTextBasedChannel
): Promise<boolean> {
  const botMember = await guildChannel.guild.members.fetch(
    interaction.client.user.id
  );
  const channelPermissions = guildChannel.permissionsFor(botMember);

  if (
    !(
      channelPermissions?.has(PermissionFlagsBits.ManageMessages) &&
      channelPermissions?.has(PermissionFlagsBits.ReadMessageHistory)
    )
  ) {
    await safelyRespond(
      interaction,
      'I do not have permission to manage messages or read message history in this channel.'
    );
    return false;
  }

  return true;
}

async function fetchMessagesToDelete(
  guildChannel: GuildTextBasedChannel,
  amount: number,
  targetUser: ReturnType<
    Parameters<OptionsCommand['execute']>[0]['options']['getUser']
  >,
  interaction: Parameters<OptionsCommand['execute']>[0]
): Promise<Message[] | null> {
  try {
    const fetchedMessages = await guildChannel.messages.fetch({ limit: 100 });
    const allMessages = Array.from(fetchedMessages.values());

    const messagesToDelete = targetUser
      ? allMessages
          .filter((msg) => msg.author.id === targetUser.id)
          .slice(0, amount)
      : allMessages.slice(0, amount);

    if (messagesToDelete.length === 0) {
      await safelyRespond(
        interaction,
        targetUser
          ? `No messages found from ${targetUser.tag} in the last 100 messages.`
          : 'No messages found to delete.'
      );
      return null;
    }

    return messagesToDelete;
  } catch (error) {
    logger.error('[PurgeCommand] Failed to fetch messages', error);
    await safelyRespond(
      interaction,
      'Failed to fetch messages from this channel.'
    );
    return null;
  }
}

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
        .setMaxValue(100)
    )
    .addStringOption((option) =>
      option
        .setName('age_limit')
        .setDescription(
          'Delete messages newer than this (e.g., 7d, 14d, max: 14d)'
        )
        .setRequired(false)
    )
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('Only delete messages from this user')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Reason for purging messages')
        .setRequired(false)
    ),
  execute: async (interaction) => {
    if (!(interaction.isChatInputCommand() && interaction.guild)) {
      return;
    }

    if (!(await validateInteraction(interaction))) {
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const { guild, channel } = interaction;
      const amount = interaction.options.getInteger('amount', true);
      const targetUser = interaction.options.getUser('user');
      const ageLimitInput = interaction.options.getString('age_limit');
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';

      const ageLimit = await determineAgeLimit(interaction, ageLimitInput);
      if (!ageLimit) {
        return;
      }

      const guildChannel = ensureGuildTextChannel(interaction, channel);
      if (!guildChannel) {
        return;
      }

      if (!(await ensureBotHasPermissions(interaction, guildChannel))) {
        return;
      }

      const messagesToDelete = await fetchMessagesToDelete(
        guildChannel,
        amount,
        targetUser,
        interaction
      );
      if (!messagesToDelete) {
        return;
      }

      const ageCutoff = Date.now() - ageLimit.ageLimitMs;
      const deletableMessages = messagesToDelete.filter(
        (msg) => msg.createdTimestamp > ageCutoff
      );

      const tooOldCount = messagesToDelete.length - deletableMessages.length;

      if (deletableMessages.length === 0) {
        await safelyRespond(
          interaction,
          `All selected messages are older than ${ageLimit.ageLimitStr} and cannot be deleted.`
        );
        return;
      }

      let deletedCount = 0;
      let deletedMessages: Message[] = [];
      try {
        const deleted = await guildChannel.bulkDelete(deletableMessages, true);
        deletedCount = deleted.size;
        deletedMessages = Array.from(deleted.values()).filter(
          (msg): msg is Message => msg instanceof Message
        );
      } catch (error) {
        logger.error('[PurgeCommand] Failed to bulk delete messages', error);
        await safelyRespond(
          interaction,
          'Failed to delete messages. Please try again.'
        );
        return;
      }

      try {
        const moderator = await guild.members.fetch(interaction.user.id);
        await logAction({
          guild,
          action: 'purge',
          channel: guildChannel,
          moderator,
          deletedMessages,
          skippedCount: tooOldCount,
          targetUser: targetUser ?? undefined,
          reason,
          ageLimit: ageLimit.ageLimitStr,
        } as PurgeLogAction);
      } catch (error) {
        logger.error('[PurgeCommand] Failed to log purge action', error);
      }

      let responseContent = `Successfully deleted ${deletedCount} message${
        deletedCount === 1 ? '' : 's'
      }`;
      if (targetUser) {
        responseContent += ` from ${targetUser.tag}`;
      }
      if (tooOldCount > 0) {
        responseContent += `\n⚠️ ${tooOldCount} message${
          tooOldCount === 1 ? ' was' : 's were'
        } skipped (older than ${ageLimit.ageLimitStr})`;
      }
      responseContent += '.';

      await safelyRespond(interaction, responseContent);
    } catch (error) {
      logger.error('[PurgeCommand] Error executing purge command', error);
      await safelyRespond(
        interaction,
        'An error occurred while purging messages.'
      );
    }
  },
};

export default command;
