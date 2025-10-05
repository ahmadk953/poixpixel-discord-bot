import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { SubcommandCommand } from '@/types/CommandTypes.js';
import { addXpToUser, getUserLevel } from '@/db/db.js';

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('Manage user XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add XP to a member')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to add XP to')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('The amount of XP to add')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove XP from a member')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to remove XP from')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('The amount of XP to remove')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set XP for a member')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to set XP for')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('amount')
            .setDescription('The amount of XP to set')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Reset XP for a member')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user to reset XP for')
            .setRequired(true),
        ),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply({
      flags: ['Ephemeral'],
    });

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);
    const userData = await getUserLevel(user.id);

    if (subcommand === 'add') {
      const amount = interaction.options.getInteger('amount', true);
      await addXpToUser(user.id, amount);
      await interaction.editReply({
        content: `Added ${amount} XP to <@${user.id}>`,
      });
    } else if (subcommand === 'remove') {
      const amount = interaction.options.getInteger('amount', true);
      await addXpToUser(user.id, -amount);
      await interaction.editReply({
        content: `Removed ${amount} XP from <@${user.id}>`,
      });
    } else if (subcommand === 'set') {
      const amount = interaction.options.getInteger('amount', true);
      await addXpToUser(user.id, amount - userData.xp);
      await interaction.editReply({
        content: `Set ${amount} XP for <@${user.id}>`,
      });
    } else if (subcommand === 'reset') {
      await addXpToUser(user.id, userData.xp * -1);
      await interaction.editReply({
        content: `Reset XP for <@${user.id}>`,
      });
    }
  },
};

export default command;
