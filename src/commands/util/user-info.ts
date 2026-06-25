import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { getMember } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { getCountingData } from '@/util/counting/countingManager.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';

type MemberData = NonNullable<Awaited<ReturnType<typeof getMember>>>;

const getSortedModerations = (
  memberData: MemberData | null,
  action: 'warning' | 'mute' | 'ban'
) => {
  return (memberData?.moderations ?? [])
    .filter((moderation) => moderation.action === action)
    .sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );
};

const getJoinedAtString = (
  member: unknown,
  interaction: Parameters<OptionsCommand['execute']>[0],
  userId: string
) => {
  try {
    if (member && typeof member === 'object' && 'joinedAt' in member) {
      const joinedAt = (member as { joinedAt?: Date }).joinedAt;
      if (joinedAt) {
        return joinedAt.toLocaleString();
      }
    }
  } catch {
    // ignore and fall back
  }

  const cachedJoined = interaction.guild?.members.cache.get(userId)?.joinedAt;
  return cachedJoined?.toLocaleString() ?? 'Not available';
};

const getCountingInfo = (
  countingData: Awaited<ReturnType<typeof getCountingData>>,
  userId: string
) => {
  const userMistakes = countingData.mistakeTracker[userId] ?? {
    mistakes: 0,
    warnings: 0,
    lastUpdated: Date.now(),
  };

  return {
    mistakes: userMistakes.mistakes ?? 0,
    warnings: userMistakes.warnings ?? 0,
    isBanned: Array.isArray(countingData.bannedUsers)
      ? countingData.bannedUsers.includes(userId)
      : false,
  };
};

const buildBasicInfoField = (
  user: Parameters<OptionsCommand['execute']>[0]['user'],
  member: ReturnType<
    Parameters<OptionsCommand['execute']>[0]['options']['getMember']
  >,
  memberData: MemberData | null,
  interaction: Parameters<OptionsCommand['execute']>[0]
) => ({
  name: '👤 Basic Information',
  value: [
    `**Username:** ${user.username}`,
    `**Discord ID:** ${user.id}`,
    `**Account Created:** ${user.createdAt.toLocaleString()}`,
    `**Joined Server:** ${getJoinedAtString(member, interaction, user.id)}`,
    `**Currently in Server:** ${memberData?.currentlyInServer ? '✅ Yes' : '❌ No'}`,
  ].join('\n'),
  inline: false,
});

const buildModerationHistoryField = (
  warningModerations: MemberData['moderations'],
  muteModerations: MemberData['moderations'],
  banModerations: MemberData['moderations'],
  memberData: MemberData | null
) => ({
  name: '🛡️ Moderation History',
  value: [
    `**Total Warnings:** ${warningModerations.length} ${warningModerations.length ? '⚠️' : ''}`,
    `**Total Mutes:** ${muteModerations.length} ${muteModerations.length ? '🔇' : ''}`,
    `**Total Bans:** ${banModerations.length} ${banModerations.length ? '🔨' : ''}`,
    `**Currently Muted:** ${memberData?.currentlyMuted ? '🔇 Yes' : '✅ No'}`,
    `**Currently Banned:** ${memberData?.currentlyBanned ? '🚫 Yes' : '✅ No'}`,
  ].join('\n'),
  inline: false,
});

const buildCountingInfoField = (
  countingInfo: ReturnType<typeof getCountingInfo>
) => ({
  name: '📊 Counting Information',
  value: [
    `**Counting Mistakes:** ${countingInfo.mistakes} ${countingInfo.mistakes ? '❌' : ''}`,
    `**Counting Warnings:** ${countingInfo.warnings} ${countingInfo.warnings ? '⚠️' : ''}`,
    `**Counting Banned:** ${countingInfo.isBanned ? '🚫 Yes' : '✅ No'}`,
  ].join('\n'),
  inline: false,
});

const buildRecentWarningsField = (
  warningModerations: MemberData['moderations']
) => ({
  name: '⚠️ Recent Warnings',
  value: warningModerations
    .slice(0, 5)
    .map(
      (warning, index) =>
        `${index + 1}. \`${warning.createdAt?.toLocaleDateString() ?? 'Unknown'}\` - ` +
        `By <@${warning.moderatorDiscordId}>\n` +
        `└ Reason: ${warning.reason ?? 'No reason provided'}`
    )
    .join('\n\n'),
  inline: false,
});

const buildCurrentMuteField = (
  memberData: MemberData | null,
  muteModerations: MemberData['moderations']
) => {
  const currentMute =
    muteModerations.find((m) => m.active) || muteModerations[0];
  if (!(memberData?.currentlyMuted && currentMute)) {
    return null;
  }

  return {
    name: '🔇 Current Mute Details',
    value: [
      `**Reason:** ${currentMute.reason ?? 'No reason provided'}`,
      `**Duration:** ${currentMute.duration ?? 'Indefinite'}`,
      `**Muted At:** ${currentMute.createdAt?.toLocaleString() ?? 'Unknown'}`,
      `**Muted By:** <@${currentMute.moderatorDiscordId}>`,
    ].join('\n'),
    inline: false,
  };
};

const buildCurrentBanField = (
  memberData: MemberData | null,
  banModerations: MemberData['moderations']
) => {
  const currentBan = banModerations.find((m) => m.active) || banModerations[0];
  if (!(memberData?.currentlyBanned && currentBan)) {
    return null;
  }

  return {
    name: '📌 Current Ban Details',
    value: [
      `**Reason:** ${currentBan.reason ?? 'No reason provided'}`,
      `**Duration:** ${currentBan.duration ?? 'Permanent'}`,
      `**Banned At:** ${currentBan.createdAt?.toLocaleString() ?? 'Unknown'}`,
    ].join('\n'),
    inline: false,
  };
};

const command: OptionsCommand = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('Provides information about the specified user.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user whose information you want to retrieve.')
        .setRequired(true)
    ),
  execute: async (interaction) => {
    if (!(await validateInteraction(interaction))) {
      await safelyRespond(
        interaction,
        'Invalid Interaction. Please try again.',
        true
      );
      return;
    }

    await interaction.deferReply();

    const user = interaction.options.getUser('user');
    const member = interaction.options.getMember('user');

    if (!user) {
      await safelyRespond(interaction, 'User not found');
      return;
    }

    const memberData = (await getMember(user.id)) ?? null;

    const warningModerations = getSortedModerations(memberData, 'warning');
    const muteModerations = getSortedModerations(memberData, 'mute');
    const banModerations = getSortedModerations(memberData, 'ban');

    const countingData = await getCountingData();
    const countingInfo = getCountingInfo(countingData, user.id);

    const embed = new EmbedBuilder()
      .setTitle(`User Information - ${user.username}`)
      .setColor(user.accentColor ?? '#5865F2')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setTimestamp()
      .addFields(
        buildBasicInfoField(user, member, memberData, interaction),
        buildModerationHistoryField(
          warningModerations,
          muteModerations,
          banModerations,
          memberData
        ),
        buildCountingInfoField(countingInfo)
      );

    if (warningModerations.length > 0) {
      embed.addFields(buildRecentWarningsField(warningModerations));
    }

    const currentMuteField = buildCurrentMuteField(memberData, muteModerations);
    if (currentMuteField) {
      embed.addFields(currentMuteField);
    }

    const currentBanField = buildCurrentBanField(memberData, banModerations);
    if (currentBanField) {
      embed.addFields(currentBanField);
    }

    embed.setFooter({
      text: `Requested by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
