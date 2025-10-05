import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

import type { Command } from '@/types/CommandTypes.js';

const rulesEmbed = new EmbedBuilder()
  .setColor(0x0099ff)
  .setTitle('Server Rules')
  .setDescription(
    'These are the rules for this server. Please read and follow them carefully.',
  )
  .addFields(
    {
      name: '**Rule #1: Be respectful**',
      value:
        'Treat everyone with kindness. No harassment, bullying, hate speech, or toxic behavior.',
    },
    {
      name: '**Rule #2: Keep it Family-Friendly**',
      value:
        'No explicit content, including NSFW images, language, or discussions. This is a safe space for everyone.',
    },
    {
      name: '**Rule #3: Use Common Sense**',
      value:
        'Think before you act or post. If something seems questionable, it is probably best not to do it.',
    },
    {
      name: '**Rule #4: No Spamming**',
      value:
        'Avoid excessive messages, emoji use, or CAPS LOCK. Keep the chat clean and readable.',
    },
    {
      name: '**Rule #5: No Raiding**',
      value:
        'Do not disrupt the server or other servers with spam, unwanted content, or malicious behavior.',
    },
    {
      name: '**Rule #6: No Self-Promotion**',
      value:
        'Do not advertise your own content or other servers without permission from staff.',
    },
    {
      name: '**Rule #7: No Impersonation**',
      value:
        'Do not pretend to be someone else, including staff or other members.',
    },
    {
      name: '**Rule #8: No Violence**',
      value:
        'Do not post or share content that is offensive, harmful, or contains violent or dangerous content.',
    },
    {
      name: '**Rule #9: No Doxxing or Sharing Personal Information**',
      value:
        'Protect your privacy and the privacy of others. Do not share personal details.',
    },
    {
      name: '**Rule #10: No Ping Abuse**',
      value:
        'Do not ping staff members unless it is absolutely necessary. Use pings responsibly for all members.',
    },
    {
      name: '**Rule #11: Use Appropriate Channels**',
      value:
        'Post content in the right channels. Off-topic content may be moved or deleted.',
    },
    {
      name: '**Rule #12: Follow the Discord Terms of Service and Community Guidelines**',
      value:
        'All members must adhere to the Discord Terms of Service and Community Guidelines.',
    },
    {
      name: '**Rule #13: Moderator Discretion**',
      value:
        'Moderators reserve the right to moderate at their discretion. If you feel mistreated, please create a support ticket.',
    },
    {
      name: '**Disclaimer:**',
      value:
        '**These rules may be updated at any time. It is your responsibility to review them regularly. Moderators and admins have the authority to enforce these rules and take appropriate action.**',
    },
  )
  .setTimestamp();

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Sends the server rules'),
  execute: async (interaction) => {
  const serverName = interaction.guild?.name ?? 'This Server';
  const serverIcon = interaction.guild?.iconURL() ?? undefined;

    const embed = new EmbedBuilder(rulesEmbed.toJSON())
      .setAuthor({ name: serverName, iconURL: serverIcon })
      .setFooter({
        text: `Requested by ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL(),
      });

    await interaction.reply({
      embeds: [embed],
    });
  },
};

export default command;
