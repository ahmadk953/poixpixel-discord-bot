import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('Provides detailed information about the server.'),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid interaction. Please try again.',
        true
      );
      return;
    }

    if (!interaction.guild) {
      await safelyRespond(
        interaction,
        'This command can only be used in a server (guild).',
        true
      );
      return;
    }

    const { guild } = interaction;
    const owner = await guild.fetchOwner();

    const channels = guild.channels.cache;
    const textChannels = channels.filter((c) => c.type === 0).size; // guildText
    const voiceChannels = channels.filter((c) => c.type === 2).size; // guildVoice
    const categoryChannels = channels.filter((c) => c.type === 4).size; // guildCategory

    const embed = new EmbedBuilder()
      .setTitle(`Server Information: ${guild.name}`)
      .setThumbnail(guild.iconURL())
      .setColor('Blue')
      .addFields(
        {
          name: 'General',
          value: `**ID:** ${guild.id}\n**Owner:** ${owner?.toString() ?? 'Unknown'}\n**Created At:** <t:${Math.floor(guild.createdAt.getTime() / 1000)}:D>\n**Verification Level:** ${guild.verificationLevel}`,
        },
        { name: 'Members', value: `**Total Members:** ${guild.memberCount}` },
        {
          name: 'Channels',
          value: `**Total:** ${channels.size}\n**Text:** ${textChannels}\n**Voice:** ${voiceChannels}\n**Categories:** ${categoryChannels}`,
        },
        { name: 'Roles', value: `**Total Roles:** ${guild.roles.cache.size}` },
        {
          name: 'Boosts',
          value: `**Boost Level:** ${guild.premiumTier}\n**Boost Count:** ${guild.premiumSubscriptionCount}`,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
