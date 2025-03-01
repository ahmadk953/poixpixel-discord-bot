import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  APIEmbed,
  JSONEncodable,
} from 'discord.js';

import { getAllMembers } from '../../db/db.js';
import { Command } from '../../types/CommandTypes.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('members')
    .setDescription('Lists all non-bot members of the server'),
  execute: async (interaction) => {
    let members = await getAllMembers();
    members = members.sort((a, b) =>
      a.discordUsername.localeCompare(b.discordUsername),
    );

    const ITEMS_PER_PAGE = 15;
    const pages: (APIEmbed | JSONEncodable<APIEmbed>)[] = [];
    for (let i = 0; i < members.length; i += ITEMS_PER_PAGE) {
      const pageMembers = members.slice(i, i + ITEMS_PER_PAGE);
      const memberList = pageMembers
        .map((m) => `**${m.discordUsername}** (${m.discordId})`)
        .join('\n');
      const embed = new EmbedBuilder()
        .setTitle('Members')
        .setDescription(memberList || 'No members to display.')
        .setColor(0x0099ff)
        .addFields({ name: 'Total Members', value: members.length.toString() })
        .setFooter({
          text: `Page ${Math.floor(i / ITEMS_PER_PAGE) + 1} of ${Math.ceil(members.length / ITEMS_PER_PAGE)}`,
        });
      pages.push(embed);
    }

    let currentPage = 0;
    const getButtonActionRow = () =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('previous')
          .setLabel('Previous')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === pages.length - 1),
      );

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

    await interaction.reply({
      embeds: [pages[currentPage]],
      components,
    });

    const message = await interaction.fetchReply();

    if (pages.length <= 1) return;

    const collector = message.createMessageComponentCollector({
      time: 60000,
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
        if (i.customId === 'previous' && currentPage > 0) {
          currentPage--;
        } else if (i.customId === 'next' && currentPage < pages.length - 1) {
          currentPage++;
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
      if (message.editable) {
        await message.edit({ components: [] });
      }
    });
  },
};

export default command;
