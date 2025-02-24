import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  SlashCommandOptionsOnlyBuilder,
  GuildMember,
  PermissionsBitField,
} from 'discord.js';
import { getMember } from '../../db/db.js';

interface Command {
  data: SlashCommandOptionsOnlyBuilder;
  execute: (interaction: CommandInteraction) => Promise<void>;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Provides information about the specified user.')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose information you want to retrieve.')
        .setRequired(true),
    ),
  execute: async (interaction) => {
    const userOption = interaction.options.get(
      'user',
    ) as unknown as GuildMember;
    const user = userOption.user;

    if (!userOption || !user) {
      await interaction.reply('User not found');
      return;
    }
    if (
      !interaction.memberPermissions!.has(
        PermissionsBitField.Flags.ModerateMembers,
      )
    ) {
      await interaction.reply(
        'You do not have permission to view member information.',
      );
      return;
    }

    const memberData = await getMember(user.id);

    const numberOfWarnings = memberData?.moderations.filter(
      (moderation) => moderation.action === 'warning',
    ).length;
    const recentWarnings = memberData?.moderations
      .filter((moderation) => moderation.action === 'warning')
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())
      .slice(0, 5);

    const numberOfMutes = memberData?.moderations.filter(
      (moderation) => moderation.action === 'mute',
    ).length;
    const currentMute = memberData?.moderations
      .filter((moderation) => moderation.action === 'mute')
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())[0];

    const numberOfBans = memberData?.moderations.filter(
      (moderation) => moderation.action === 'ban',
    ).length;
    const currentBan = memberData?.moderations
      .filter((moderation) => moderation.action === 'ban')
      .sort((a, b) => b.createdAt!.getTime() - a.createdAt!.getTime())[0];

    const embed = new EmbedBuilder()
      .setTitle(`User Information - ${user?.username}`)
      .setColor(user.accentColor || '#5865F2')
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
              interaction.guild?.members.cache
                .get(user.id)
                ?.joinedAt?.toLocaleString() || 'Not available'
            }`,
            `**Currently in Server:** ${memberData?.currentlyInServer ? '✅ Yes' : '❌ No'}`,
          ].join('\n'),
          inline: false,
        },
        {
          name: '🛡️ Moderation History',
          value: [
            `**Total Warnings:** ${numberOfWarnings || '0'} ${numberOfWarnings ? '⚠️' : ''}`,
            `**Total Mutes:** ${numberOfMutes || '0'} ${numberOfMutes ? '🔇' : ''}`,
            `**Total Bans:** ${numberOfBans || '0'} ${numberOfBans ? '🔨' : ''}`,
            `**Currently Muted:** ${memberData?.currentlyMuted ? '🔇 Yes' : '✅ No'}`,
            `**Currently Banned:** ${memberData?.currentlyBanned ? '🚫 Yes' : '✅ No'}`,
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
              `${index + 1}. \`${warning.createdAt?.toLocaleDateString() || 'Unknown'}\` - ` +
              `By <@${warning.moderatorDiscordId}>\n` +
              `└ Reason: ${warning.reason || 'No reason provided'}`,
          )
          .join('\n\n'),
        inline: false,
      });
    }
    if (memberData?.currentlyMuted && currentMute) {
      embed.addFields({
        name: '🔇 Current Mute Details',
        value: [
          `**Reason:** ${currentMute.reason || 'No reason provided'}`,
          `**Duration:** ${currentMute.duration || 'Indefinite'}`,
          `**Muted At:** ${currentMute.createdAt?.toLocaleString() || 'Unknown'}`,
          `**Muted By:** <@${currentMute.moderatorDiscordId}>`,
        ].join('\n'),
        inline: false,
      });
    }
    if (memberData?.currentlyBanned && currentBan) {
      embed.addFields({
        name: '📌 Current Ban Details',
        value: [
          `**Reason:** ${currentBan.reason || 'No reason provided'}`,
          `**Duration:** ${currentBan.duration || 'Permanent'}`,
          `**Banned At:** ${currentBan.createdAt?.toLocaleString() || 'Unknown'}`,
        ].join('\n'),
        inline: false,
      });
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
