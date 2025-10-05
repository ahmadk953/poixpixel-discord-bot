import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import logAction from '@/util/logging/logAction.js';
import { logger } from '@/util/logger.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to kick')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the kick')
        .setRequired(true),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const { guild } = interaction;
      const moderator = await guild.members.fetch(interaction.user.id);
      const targetUser = interaction.options.getUser('member', true);
      const member = await guild.members.fetch(targetUser.id);
      const reason = interaction.options.getString('reason', true);

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await interaction.editReply({
          content:
            'You cannot kick a member with equal or higher role than yours.',
        });
        return;
      }

      if (!member.kickable) {
        await interaction.editReply({
          content: 'I do not have permission to kick this member.',
        });
        return;
      }

      try {
        await member.user.send(
          `You have been kicked from ${guild.name}. Reason: ${reason}. You can join back at: \n${guild.vanityURLCode ?? loadConfig().serverInvite}`,
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

      await interaction.editReply({
        content: `<@${member.id}> has been kicked. Reason: ${reason}`,
      });
    } catch (error) {
      logger.error('[KickCommand] Error executing kick command', error);
      await interaction.editReply({
        content: 'Unable to kick member.',
      });
    }
  },
};

export default command;
