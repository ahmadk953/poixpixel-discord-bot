import {
  ActionRowBuilder,
  type APIEmbed,
  type ButtonInteraction,
  EmbedBuilder,
  type JSONEncodable,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';

import { getLevelLeaderboard } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import {
  createPaginationButtons,
  safelyRespond,
  safeRemoveComponents,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Shows the server XP leaderboard')
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of users per page (default: 10)')
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

    await interaction.deferReply();

    const guild = interaction.guild;
    if (!guild) {
      await safelyRespond(
        interaction,
        'Could not fetch guild information.',
        true
      );
      return;
    }

    try {
      const rawLimit = interaction.options.getInteger('limit');
      const usersPerPage = Math.min(100, Math.max(1, rawLimit ?? 10));

      const allUsers = await getLevelLeaderboard(100);

      const presentUsers = allUsers.filter((u) =>
        guild.members.cache.has(u.discordId)
      );

      if (presentUsers.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('🏆 Server Leaderboard')
          .setColor(0x58_65_f2)
          .setDescription('No users found on the leaderboard yet.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const pages: (APIEmbed | JSONEncodable<APIEmbed>)[] = [];

      for (let i = 0; i < presentUsers.length; i += usersPerPage) {
        const pageUsers = presentUsers.slice(i, i + usersPerPage);
        let leaderboardText = '';

        for (let j = 0; j < pageUsers.length; j++) {
          const user = pageUsers[j];
          const position = i + j + 1;

          leaderboardText += `**${position}.** <@${user.discordId}> - Level ${user.level} (${user.xp} XP)\n`;
        }

        const embed = new EmbedBuilder()
          .setTitle('🏆 Server Leaderboard')
          .setColor(0x58_65_f2)
          .setDescription(leaderboardText)
          .setTimestamp()
          .setFooter({
            text: `Page ${Math.floor(i / usersPerPage) + 1} of ${Math.ceil(
              presentUsers.length / usersPerPage
            )}`,
          });

        pages.push(embed);
      }

      let currentPage = 0;

      const getButtonActionRow = () =>
        createPaginationButtons(pages.length, currentPage);

      const getSelectMenuRow = () => {
        if (pages.length > 25) {
          return null;
        }

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
          select
        );
      };

      const selectRow = getSelectMenuRow();

      const components =
        pages.length > 1
          ? [getButtonActionRow(), ...(selectRow ? [selectRow] : [])]
          : [];

      const message = await interaction.editReply({
        embeds: [pages[currentPage]],
        components,
      });

      if (pages.length <= 1) {
        return;
      }

      const collector = message.createMessageComponentCollector({
        time: 60_000,
      });

      function handleButton(i: ButtonInteraction) {
        switch (i.customId) {
          case 'first_page':
            currentPage = 0;
            break;
          case 'prev_page':
            if (currentPage > 0) {
              currentPage--;
            }
            break;
          case 'next_page':
            if (currentPage < pages.length - 1) {
              currentPage++;
            }
            break;
          case 'last_page':
            currentPage = pages.length - 1;
            break;
          default:
            break;
        }
      }

      function handleSelectMenu(i: StringSelectMenuInteraction) {
        const selected = Number.parseInt(i.values[0], 10);
        if (
          !Number.isNaN(selected) &&
          selected >= 0 &&
          selected < pages.length
        ) {
          currentPage = selected;
        }
      }

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          if (await validateInteraction(i)) {
            await safelyRespond(i, 'These controls are not for you!', true);
          }
          return;
        }

        if (i.isButton()) {
          handleButton(i);
        }

        if (i.isStringSelectMenu()) {
          handleSelectMenu(i);
        }

        const updatedSelect = getSelectMenuRow();
        await i.update({
          embeds: [pages[currentPage]],
          components: [
            getButtonActionRow(),
            ...(updatedSelect ? [updatedSelect] : []),
          ],
        });
      });

      collector.on('end', async () => {
        await safeRemoveComponents(message).catch(() => null);
      });
    } catch (error) {
      logger.error('[LeaderboardCommand] Error getting leaderboard', error);
      await safelyRespond(
        interaction,
        'Failed to get leaderboard information.'
      );
    }
  },
};

export default command;
