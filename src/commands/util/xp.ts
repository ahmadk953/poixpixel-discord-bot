import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import type { SubcommandCommand } from '@/types/CommandTypes.js';
import { addXpToUser, getUserLevel, setXpForUser } from '@/db/db.js';
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
            .setMinValue(1)
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
            .setMinValue(1)
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
            .setMinValue(0)
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

    if (!(await validateInteraction(interaction))) {
      return await safelyRespond(
        interaction,
        'This interaction is no longer valid or cannot be processed (missing channel or message).',
      );
    }

    await interaction.deferReply({ flags: ['Ephemeral'] });

    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user', true);

    if (subcommand === 'add') {
      const amount = interaction.options.getInteger('amount', true);

      await addXpToUser(user.id, amount, false);
      await safelyRespond(interaction, `Added ${amount} XP to <@${user.id}>`);
      return;
    }

    if (subcommand === 'remove') {
      const amount = interaction.options.getInteger('amount', true);

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

      await setXpForUser(user.id, finalXp);
      await safelyRespond(
        interaction,
        `Removed ${amount} XP from <@${user.id}> (now ${finalXp} XP)`,
      );
      return;
    }

    if (subcommand === 'set') {
      const amount = interaction.options.getInteger('amount', true);
      const res = await setXpForUser(user.id, amount);

      await safelyRespond(
        interaction,
        `Set ${res.xp} XP for <@${user.id}> (was ${res.oldXp} XP)`,
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

      const res = await setXpForUser(user.id, 0);
      await safelyRespond(
        interaction,
        `Reset XP for <@${user.id}> (was ${res.oldXp} XP)`,
      );
      return;
    }
  },
};

export default command;
