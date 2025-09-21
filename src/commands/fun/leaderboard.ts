import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  APIEmbed,
  JSONEncodable,
} from 'discord.js';

import { OptionsCommand } from '@/types/CommandTypes.js';
import { getLevelLeaderboard } from '@/db/db.js';
import { createPaginationButtons } from '@/util/helpers.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Shows the server XP leaderboard')
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of users per page (default: 10)')
        .setRequired(false),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply();

    try {
      const usersPerPage = interaction.options.getInteger('limit') || 10;

      const allUsers = await getLevelLeaderboard(100);

      if (allUsers.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🏆 Server Leaderboard')
          .setColor(0x5865f2)
          .setDescription('No users found on the leaderboard yet.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }

      const pages: (APIEmbed | JSONEncodable<APIEmbed>)[] = [];

      for (let i = 0; i < allUsers.length; i += usersPerPage) {
        const pageUsers = allUsers.slice(i, i + usersPerPage);
        let leaderboardText = '';

        for (let j = 0; j < pageUsers.length; j++) {
          const user = pageUsers[j];
          const position = i + j + 1;

          try {
            const member = await interaction.guild.members.fetch(
              user.discordId,
            );
            leaderboardText += `**${position}.** ${member} - Level ${user.level} (${user.xp} XP)\n`;
          } catch {
            leaderboardText += `**${position}.** <@${user.discordId}> - Level ${user.level} (${user.xp} XP)\n`;
          }
        }

        const embed = new EmbedBuilder()
          .setTitle('🏆 Server Leaderboard')
          .setColor(0x5865f2)
          .setDescription(leaderboardText)
          .setTimestamp()
          .setFooter({
            text: `Page ${Math.floor(i / usersPerPage) + 1} of ${Math.ceil(allUsers.length / usersPerPage)}`,
          });

        pages.push(embed);
      }

      let currentPage = 0;

      const getButtonActionRow = () =>
        createPaginationButtons(pages.length, currentPage);

      const getSelectMenuRow = () => {
        const options = pages.map((_, index) => ({
          label: `Page ${index + 1}`,
          value: index.toString(),
          default: index === currentPage,
        }));

        const select = new StringSelectMenuBuilder()
          .setCustomId('select_page')
          .setPlaceholder('Jump to a page')
          .addOptions(options);

        return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          select,
        );
      };

      const components =
        pages.length > 1 ? [getButtonActionRow(), getSelectMenuRow()] : [];

      const message = await interaction.editReply({
        embeds: [pages[currentPage]],
        components,
      });

      if (pages.length <= 1) return;

      const collector = message.createMessageComponentCollector({
        time: 300000,
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: 'These controls are not for you!',
            flags: ['Ephemeral'],
          });
          return;
        }

        if (i.isButton()) {
          switch (i.customId) {
            case 'first':
              currentPage = 0;
              break;
            case 'prev':
              if (currentPage > 0) currentPage--;
              break;
            case 'next':
              if (currentPage < pages.length - 1) currentPage++;
              break;
            case 'last':
              currentPage = pages.length - 1;
              break;
          }
        }

        if (i.isStringSelectMenu()) {
          const selected = parseInt(i.values[0]);
          if (!isNaN(selected) && selected >= 0 && selected < pages.length) {
            currentPage = selected;
          }
        }

        await i.update({
          embeds: [pages[currentPage]],
          components: [getButtonActionRow(), getSelectMenuRow()],
        });
      });

      collector.on('end', async () => {
        if (message) {
          try {
            await interaction.editReply({ components: [] });
          } catch (error) {
            console.error('Error removing components:', error);
          }
        }
      });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      await interaction.editReply('Failed to get leaderboard information.');
    }
  },
};

export default command;
