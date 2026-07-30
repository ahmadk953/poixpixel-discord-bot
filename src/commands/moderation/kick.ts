import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';
import logAction from '@/util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to kick')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the kick')
        .setRequired(false)
    ),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const { guild } = interaction;

      if (!guild) {
        await safelyRespond(
          interaction,
          'This command can only be used in a server (guild).',
          true
        );
        return;
      }
      const moderator = await guild.members.fetch(interaction.user.id);
      const targetUser = interaction.options.getUser('member', true);
      const member = await guild.members.fetch(targetUser.id);
      const reason =
        interaction.options.getString('reason') ?? 'No reason provided';

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await safelyRespond(
          interaction,
          'You cannot kick a member with equal or higher role than yours.'
        );
        return;
      }

      if (!member.kickable) {
        await safelyRespond(
          interaction,
          'I do not have permission to kick this member.'
        );
        return;
      }

      try {
        await member.user.send(
          `You have been kicked from ${guild.name}. Reason: ${reason}. You can join back at: \n${guild.vanityURLCode ?? loadConfig().serverInvite}`
        );
      } catch (error) {
        logger.error('[KickCommand] Failed to send DM to kicked user', error);
      }

      await member.kick(reason);

      await updateMemberModerationHistory({
        discordId: member.id,
        moderatorDiscordId: interaction.user.id,
        action: 'kick',
        reason,
        duration: '',
        createdAt: new Date(),
      });

      await logAction({
        guild,
        action: 'kick',
        target: member,
        moderator,
        reason,
      });

      await safelyRespond(
        interaction,
        `<@${member.id}> has been kicked. Reason: ${reason}`
      );
    } catch (error) {
      logger.error('[KickCommand] Error executing kick command', error);
      await safelyRespond(interaction, 'Unable to kick member.');
    }
  },
};

export default command;
