import {
  SlashCommandBuilder,
  EmbedBuilder,
  type GuildMember,
  PermissionFlagsBits,
} from 'discord.js';

import { getMember } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { getCountingData } from '@/util/counting/countingManager.js';

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Provides information about the specified user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose information you want to retrieve.')
        .setRequired(true),
    ),
  execute: async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply();

    // Use the type-safe accessors provided by discord.js
    const user = interaction.options.getUser('user');
    // getMember may return a GuildMember or an APIInteractionGuildMember or null
    const member = interaction.options.getMember('user');

    if (!user) {
      await interaction.editReply('User not found');
      return;
    }

    const memberData = await getMember(user.id);

    const numberOfWarnings = memberData?.moderations.filter(
      (moderation) => moderation.action === 'warning',
    ).length;
    const recentWarnings = memberData?.moderations
      .filter((moderation) => moderation.action === 'warning')
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      )
      .slice(0, 5);

    const numberOfMutes = memberData?.moderations.filter(
      (moderation) => moderation.action === 'mute',
    ).length;
    const currentMute = memberData?.moderations
      .filter((moderation) => moderation.action === 'mute')
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      )[0];

    const numberOfBans = memberData?.moderations.filter(
      (moderation) => moderation.action === 'ban',
    ).length;
    const currentBan = memberData?.moderations
      .filter((moderation) => moderation.action === 'ban')
      .sort(
        (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
      )[0];

    const countingData = await getCountingData();
    const userMistakes = countingData.mistakeTracker[user.id] ?? {
      mistakes: 0,
      warnings: 0,
      lastUpdated: Date.now(),
    };
    const countingWarnings = userMistakes.warnings ?? 0;
    const countingMistakes = userMistakes.mistakes ?? 0;
    const isCountingBanned = Array.isArray(countingData.bannedUsers)
      ? countingData.bannedUsers.includes(user.id)
      : false;

    const embed = new EmbedBuilder()
      .setTitle(`User Information - ${user?.username}`)
      .setColor(user.accentColor ?? '#5865F2')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setTimestamp()
      .addFields(
        {
          name: '👤 Basic Information',
          value: [
            `**Username:** ${user.username}`,
            `**Discord ID:** ${user.id}`,
            `**Account Created:** ${user.createdAt.toLocaleString()}`,
            `**Joined Server:** ${
              // Prefer the typed member returned by getMember; fall back to guild cache
              (member as GuildMember | null)?.joinedAt?.toLocaleString() ??
              interaction.guild?.members.cache
                .get(user.id)
                ?.joinedAt?.toLocaleString() ??
              'Not available'
            }`,
            `**Currently in Server:** ${memberData?.currentlyInServer ? '✅ Yes' : '❌ No'}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛡️ Moderation History',
          value: [
            `**Total Warnings:** ${numberOfWarnings ?? 0} ${numberOfWarnings ? '⚠️' : ''}`,
            `**Total Mutes:** ${numberOfMutes ?? 0} ${numberOfMutes ? '🔇' : ''}`,
            `**Total Bans:** ${numberOfBans ?? 0} ${numberOfBans ? '🔨' : ''}`,
            `**Currently Muted:** ${memberData?.currentlyMuted ? '🔇 Yes' : '✅ No'}`,
            `**Currently Banned:** ${memberData?.currentlyBanned ? '🚫 Yes' : '✅ No'}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '📊 Counting Information',
          value: [
            `**Counting Mistakes:** ${countingMistakes} ${countingMistakes ? '❌' : ''}`,
            `**Counting Warnings:** ${countingWarnings} ${countingWarnings ? '⚠️' : ''}`,
            `**Counting Banned:** ${isCountingBanned ? '🚫 Yes' : '✅ No'}`,
          ].join('\n'),
          inline: false,
        },
      );

    if (recentWarnings && recentWarnings.length > 0) {
      embed.addFields({
        name: '⚠️ Recent Warnings',
        value: recentWarnings
          .map(
            (warning, index) =>
              `${index + 1}. \`${warning.createdAt?.toLocaleDateString() ?? 'Unknown'}\` - ` +
              `By <@${warning.moderatorDiscordId}>\n` +
              `└ Reason: ${warning.reason ?? 'No reason provided'}`,
          )
          .join('\n\n'),
        inline: false,
      });
    }
    if (memberData?.currentlyMuted && currentMute) {
      embed.addFields({
        name: '🔇 Current Mute Details',
        value: [
          `**Reason:** ${currentMute.reason ?? 'No reason provided'}`,
          `**Duration:** ${currentMute.duration ?? 'Indefinite'}`,
          `**Muted At:** ${currentMute.createdAt?.toLocaleString() ?? 'Unknown'}`,
          `**Muted By:** <@${currentMute.moderatorDiscordId}>`,
        ].join('\n'),
        inline: false,
      });
    }
    if (memberData?.currentlyBanned && currentBan) {
      embed.addFields({
        name: '📌 Current Ban Details',
        value: [
          `**Reason:** ${currentBan.reason ?? 'No reason provided'}`,
          `**Duration:** ${currentBan.duration ?? 'Permanent'}`,
          `**Banned At:** ${currentBan.createdAt?.toLocaleString() ?? 'Unknown'}`,
        ].join('\n'),
        inline: false,
      });
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
