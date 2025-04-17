import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} from 'discord.js';

import { SubcommandCommand } from '@/types/CommandTypes.js';
import { getCountingData, setCount } from '@/util/countingManager.js';
import { loadConfig } from '@/util/configLoader.js';

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('counting')
    .setDescription('Commands related to the counting channel')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Check the current counting status'),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setcount')
        .setDescription(
          'Set the current count to a specific number (Admin only)',
        )
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('The number to set as the current count')
            .setRequired(true)
            .setMinValue(0),
        ),
    ),

  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'status') {
      const countingData = await getCountingData();
      const countingChannelId = loadConfig().channels.counting;

      const embed = new EmbedBuilder()
        .setTitle('Counting Channel Status')
        .setColor(0x0099ff)
        .addFields(
          {
            name: 'Current Count',
            value: countingData.currentCount.toString(),
            inline: true,
          },
          {
            name: 'Next Number',
            value: (countingData.currentCount + 1).toString(),
            inline: true,
          },
          {
            name: 'Highest Count',
            value: countingData.highestCount.toString(),
            inline: true,
          },
          {
            name: 'Total Correct Counts',
            value: countingData.totalCorrect.toString(),
            inline: true,
          },
          {
            name: 'Counting Channel',
            value: `<#${countingChannelId}>`,
            inline: true,
          },
        )
        .setFooter({ text: 'Remember: No user can count twice in a row!' })
        .setTimestamp();

      if (countingData.lastUserId) {
        embed.addFields({
          name: 'Last Counter',
          value: `<@${countingData.lastUserId}>`,
          inline: true,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === 'setcount') {
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.Administrator,
        )
      ) {
        await interaction.editReply({
          content: 'You need administrator permissions to use this command.',
        });
        return;
      }

      const count = interaction.options.getInteger('count');
      if (count === null) {
        await interaction.editReply({
          content: 'Invalid count specified.',
        });
        return;
      }

      try {
        await setCount(count);
        await interaction.editReply({
          content: `Count has been set to **${count}**. The next number should be **${count + 1}**.`,
        });
      } catch (error) {
        await interaction.editReply({
          content: `Failed to set the count: ${error}`,
        });
      }

      await interaction.editReply({
        content: `Count has been set to **${count}**. The next number should be **${count + 1}**.`,
      });
    }
  },
};

export default command;
