import { PermissionsBitField, SlashCommandBuilder } from 'discord.js';

import { updateMemberModerationHistory } from '../../db/db.js';
import { OptionsCommand } from '../../types/CommandTypes.js';
import logAction from '../../util/logging/logAction.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
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
    const moderator = await interaction.guild?.members.fetch(
      interaction.user.id,
    );
    const member = await interaction.guild?.members.fetch(
      interaction.options.get('member')!.value as unknown as string,
    );
    const reason = interaction.options.get('reason')
      ?.value as unknown as string;

    if (
      !interaction.memberPermissions?.has(
        PermissionsBitField.Flags.ModerateMembers,
      ) ||
      moderator!.roles.highest.position <= member!.roles.highest.position
    ) {
      await interaction.reply({
        content: 'You do not have permission to warn this member.',
        flags: ['Ephemeral'],
      });
      return;
    }

    try {
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
      await interaction.reply(
        `<@${member!.user.id}> has been warned. Reason: ${reason}`,
      );
      await logAction({
        guild: interaction.guild!,
        action: 'warn',
        target: member!,
        moderator: moderator!,
        reason: reason,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: 'There was an error trying to warn the member.',
        flags: ['Ephemeral'],
      });
    }
  },
};

export default command;
