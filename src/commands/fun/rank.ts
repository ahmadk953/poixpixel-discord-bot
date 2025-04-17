import { SlashCommandBuilder } from 'discord.js';

import { OptionsCommand } from '@/types/CommandTypes.js';
import { generateRankCard, getXpToNextLevel } from '@/util/levelingSystem.js';
import { getUserLevel } from '@/db/db.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Shows your current rank and level')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to check rank for (defaults to yourself)')
        .setRequired(false),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply();

    try {
      const member = await interaction.guild.members.fetch(
        (interaction.options.get('user')?.value as string) ||
          interaction.user.id,
      );

      const userData = await getUserLevel(member.id);
      const rankCard = await generateRankCard(member, userData);

      const xpToNextLevel = getXpToNextLevel(userData.level, userData.xp);

      await interaction.editReply({
        content: `${member}'s rank - Level ${userData.level} (${userData.xp} XP, ${xpToNextLevel} XP until next level)`,
        files: [rankCard],
      });
    } catch (error) {
      console.error('Error getting rank:', error);
      await interaction.editReply('Failed to get rank information.');
    }
  },
};

export default command;
