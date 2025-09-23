import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '@/db/db.js';
import { OptionsCommand } from '@/types/CommandTypes.js';
import logAction from '@/util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('member')
        .setDescription('The member to warn')
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('The reason for the warning')
        .setRequired(true),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    try {
      const moderator = await interaction.guild.members.fetch(
        interaction.user.id,
      );
      const member = await interaction.guild.members.fetch(
        interaction.options.get('member')!.value as unknown as string,
      );
      const reason = interaction.options.getString('reason')!;

      if (moderator.roles.highest.position <= member.roles.highest.position) {
        await interaction.editReply({
          content:
            'You cannot warn a member with equal or higher role than yours.',
        });
        return;
      }

      await updateMemberModerationHistory({
        discordId: member!.user.id,
        moderatorDiscordId: interaction.user.id,
        action: 'warning',
        reason: reason,
        duration: '',
      });
      await member!.user.send(
        `You have been warned in **${interaction?.guild?.name}**. Reason: **${reason}**.`,
      );
      await logAction({
        guild: interaction.guild!,
        action: 'warn',
        target: member!,
        moderator: moderator!,
        reason: reason,
      });
      await interaction.editReply(
        `<@${member!.user.id}> has been warned. Reason: ${reason}`,
      );
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: 'There was an error trying to warn the member.',
      });
    }
  },
};

export default command;
