import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { SubcommandCommand } from '@/types/CommandTypes.js';
import { addXpToUser, getUserLevel } from '@/db/db.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';

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

    if (!(await validateInteraction(interaction))) return;

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);

    if (subcommand === 'add') {
      const amount = interaction.options.getInteger('amount', true);
      if (amount <= 0) {
        await safelyRespond(
          interaction,
          'Amount to add must be a positive integer.',
        );
        return;
      }

      await addXpToUser(user.id, amount, false);
      await safelyRespond(interaction, `Added ${amount} XP to <@${user.id}>`);
      return;
    }

    if (subcommand === 'remove') {
      const amount = interaction.options.getInteger('amount', true);
      if (amount <= 0) {
        await safelyRespond(
          interaction,
          'Amount to remove must be a positive integer.',
        );
        return;
      }

      const fresh = await getUserLevel(user.id);
      const currentXp = fresh.xp ?? 0;
      if (currentXp < amount) {
        await safelyRespond(
          interaction,
          `Cannot remove ${amount} XP from <@${user.id}> — they only have ${currentXp} XP.`,
        );
        return;
      }

      const finalXp = Math.max(0, currentXp - amount);
      const delta = finalXp - currentXp;

      await addXpToUser(user.id, delta, false);
      await safelyRespond(
        interaction,
        `Removed ${amount} XP from <@${user.id}> (now ${finalXp} XP)`,
      );
      return;
    }

    if (subcommand === 'set') {
      const amount = interaction.options.getInteger('amount', true);
      if (amount < 0) {
        await safelyRespond(
          interaction,
          'Amount to set must be a non-negative integer.',
        );
        return;
      }

      const freshForSet = await getUserLevel(user.id);
      const currentForSet = freshForSet.xp ?? 0;
      const desired = Math.max(0, amount);
      const deltaForSet = desired - currentForSet;

      await addXpToUser(user.id, deltaForSet, false);
      await safelyRespond(
        interaction,
        `Set ${desired} XP for <@${user.id}> (was ${currentForSet} XP)`,
      );
      return;
    }

    if (subcommand === 'reset') {
      const freshForReset = await getUserLevel(user.id);
      const currentForReset = freshForReset.xp ?? 0;

      if (currentForReset === 0) {
        await safelyRespond(interaction, `<@${user.id}> already has 0 XP.`);
        return;
      }

      const deltaForReset = -currentForReset;
      await addXpToUser(user.id, deltaForReset, false);
      await safelyRespond(
        interaction,
        `Reset XP for <@${user.id}> (was ${currentForReset} XP)`,
      );
      return;
    }
  },
};

export default command;
