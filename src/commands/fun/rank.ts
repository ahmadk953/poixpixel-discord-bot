import { SlashCommandBuilder } from 'discord.js';

import { getUserLevel } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { safelyRespond, validateInteraction } from '@/util/helpers';
import { generateRankCard, getXpToNextLevel } from '@/util/levelingSystem.js';
import { logger } from '@/util/logger.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Shows your current rank and level')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to check rank for (defaults to yourself)')
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

    const guild = interaction.guild;
    if (!guild) {
      await safelyRespond(interaction, 'Guild not found.', true);
      return;
    }

    await interaction.deferReply();

    try {
      const member = await guild.members.fetch(
        (interaction.options.get('user')?.value as string) ??
          interaction.user.id
      );

      const userData = await getUserLevel(member.id);
      const rankCard = await generateRankCard(member, userData);

      const xpToNextLevel = getXpToNextLevel(userData.level, userData.xp);

      await interaction.editReply({
        content: `${member}'s rank - Level ${userData.level} (${userData.xp} XP, ${xpToNextLevel} XP until next level)`,
        files: [rankCard],
      });
    } catch (error) {
      logger.error('[RankCommand] Error executing rank command', error);
      await safelyRespond(interaction, 'Failed to get rank information.');
    }
  },
};

export default command;
