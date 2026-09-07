import {
  ActionRowBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';

import { getMember } from '@/db/db.js';
import type { OptionsCommand } from '@/types/CommandTypes.js';
import { getCountingData } from '@/util/counting/countingManager.js';
import {
  msToDiscordTimestamp,
  safelyRespond,
  validateInteraction,
} from '@/util/helpers.js';

const RECENT_MODERATION_LIMIT = 5;
const SELECT_TIMEOUT_MS = 60_000;

type MemberData = NonNullable<Awaited<ReturnType<typeof getMember>>>;

type UserInfoPage = (typeof USER_INFO_PAGE_DEFINITIONS)[number] & {
  embed: EmbedBuilder;
};

const getSortedModerations = (
  memberData: MemberData | null,
  action: 'warning' | 'mute' | 'ban' | 'kick'
) =>
  (memberData?.moderations ?? [])
    .filter((moderation) => moderation.action === action)
    .sort(
      (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
    );

const formatTimestamp = (value: number | string | Date | null | undefined) => {
  if (value == null) {
    return 'Not available';
  }
  let ms: number;
  if (value instanceof Date) {
    ms = value.getTime();
  } else if (typeof value === 'string') {
    ms = new Date(value).getTime();
  } else {
    ms = value;
  }
  return msToDiscordTimestamp(ms);
};

const getJoinedAtString = (
  interaction: Parameters<OptionsCommand['execute']>[0],
  userId: string
) => {
  const cachedJoined = interaction.guild?.members.cache.get(userId)?.joinedAt;
  return cachedJoined
    ? msToDiscordTimestamp(cachedJoined.getTime())
    : 'Not available';
};

const formatModerationReason = (reason: string | null | undefined) =>
  reason?.trim() || 'No reason provided';

const formatModerationDuration = (
  duration: string | null | undefined,
  fallback: string
) => duration?.trim() || fallback;

const getCurrentModeration = (moderations: MemberData['moderations']) =>
  moderations.find((moderation) => moderation.active) ?? moderations[0];

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
  interaction: Parameters<OptionsCommand['execute']>[0]
) => ({
  name: '👤 Basic Information',
  value: [
    `**🏷️ Username:** ${user.username}`,
    `**🆔 Discord ID:** ${user.id}`,
    `**📅 Account Created:** ${msToDiscordTimestamp(user.createdAt.getTime())}`,
    `**🏠 Joined Server:** ${getJoinedAtString(interaction, user.id)}`,
  ].join('\n'),
  inline: false,
});

const buildServerRecordField = (
  user: Parameters<OptionsCommand['execute']>[0]['user'],
  memberData: MemberData | null
) => ({
  name: '🗄️ Server Record',
  value: [
    `**💾 Stored Username:** ${memberData?.discordUsername ?? user.username}`,
    `**✅ Currently in Server:** ${memberData?.currentlyInServer ? 'Yes' : '❌ No'}`,
    `**🕒 Last Left At:** ${formatTimestamp(memberData?.lastLeftAt)}`,
  ].join('\n'),
  inline: false,
});

const buildQuickStatsField = (
  memberData: MemberData | null,
  countingInfo: ReturnType<typeof getCountingInfo>
) => ({
  name: '📊 Quick Stats',
  value: [
    `**⚠️ Warnings:** ${memberData?.moderations?.filter((m) => m.action === 'warning').length ?? 0}`,
    `**🔇 Mutes:** ${memberData?.moderations?.filter((m) => m.action === 'mute').length ?? 0}`,
    `**👢 Kicks:** ${memberData?.moderations?.filter((m) => m.action === 'kick').length ?? 0}`,
    `**🚫 Bans:** ${memberData?.moderations?.filter((m) => m.action === 'ban').length ?? 0}`,
    `**🔇 Currently Muted:** ${memberData?.currentlyMuted ? '✅ Yes' : '❌ No'}`,
    `**🚫 Currently Banned:** ${memberData?.currentlyBanned ? '✅ Yes' : '❌ No'}`,
    `**📊 Counting Banned:** ${countingInfo.isBanned ? '✅ Yes' : '❌ No'}`,
  ].join('\n'),
  inline: false,
});

const buildModerationHistoryField = ({
  warningModerations,
  muteModerations,
  banModerations,
  kickModerations,
  memberData,
}: {
  warningModerations: MemberData['moderations'];
  muteModerations: MemberData['moderations'];
  banModerations: MemberData['moderations'];
  kickModerations: MemberData['moderations'];
  memberData: MemberData | null;
}) => ({
  name: '🛡️ Moderation History',
  value: [
    `**⚠️ Total Warnings:** ${warningModerations.length}`,
    `**🔇 Total Mutes:** ${muteModerations.length}`,
    `**🚫 Total Bans:** ${banModerations.length}`,
    `**👢 Total Kicks:** ${kickModerations.length}`,
    `**🔇 Currently Muted:** ${memberData?.currentlyMuted ? '✅ Yes' : '❌ No'}`,
    `**🚫 Currently Banned:** ${memberData?.currentlyBanned ? '✅ Yes' : '❌ No'}`,
  ].join('\n'),
  inline: false,
});

const buildCountingInfoField = (
  countingInfo: ReturnType<typeof getCountingInfo>
) => ({
  name: '📊 Counting Information',
  value: [
    `**❌ Counting Mistakes:** ${countingInfo.mistakes}`,
    `**⚠️ Counting Warnings:** ${countingInfo.warnings}`,
    `**🚫 Counting Banned:** ${countingInfo.isBanned ? '✅ Yes' : '❌ No'}`,
  ].join('\n'),
  inline: false,
});

const buildRecentModerationsField = ({
  name,
  moderations,
}: {
  name: string;
  moderations: MemberData['moderations'];
}) => ({
  name,
  value: moderations
    .slice(0, RECENT_MODERATION_LIMIT)
    .map(
      (moderation, index) =>
        `**#${index + 1}** ${msToDiscordTimestamp(
          moderation.createdAt.getTime(),
          'd'
        )} - By <@${moderation.moderatorDiscordId}>\n` +
        `└ Reason: ${formatModerationReason(moderation.reason)}`
    )
    .join('\n\n'),
  inline: false,
});

const buildCurrentModerationField = ({
  name,
  moderations,
  isActive,
  durationFallback,
  includeModerator,
  timestampLabel,
}: {
  name: string;
  moderations: MemberData['moderations'];
  isActive: boolean;
  durationFallback: string;
  includeModerator: boolean;
  timestampLabel: string;
}) => {
  const currentModeration = getCurrentModeration(moderations);
  if (!(isActive && currentModeration)) {
    return;
  }

  return {
    name,
    value: [
      `**Reason:** ${formatModerationReason(currentModeration.reason)}`,
      `**Duration:** ${formatModerationDuration(
        currentModeration.duration,
        durationFallback
      )}`,
      `**${timestampLabel}:** ${msToDiscordTimestamp(
        currentModeration.createdAt.getTime(),
        'd'
      )}`,
      ...(includeModerator
        ? [`**By:** <@${currentModeration.moderatorDiscordId}>`]
        : []),
    ].join('\n'),
    inline: false,
  };
};

const buildCountingRoomStatsField = (
  countingData: Awaited<ReturnType<typeof getCountingData>>
) => ({
  name: '🏆 Counting Stats',
  value: [
    `**🔢 Current Count:** ${countingData.currentCount}`,
    `**🔝 Highest Count:** ${countingData.highestCount}`,
    `**✅ Total Correct:** ${countingData.totalCorrect}`,
    `**🕒 Updated At:** ${msToDiscordTimestamp(countingData.updatedAt)}`,
  ].join('\n'),
  inline: false,
});

const buildCountingBanDetailsField = (
  countingData: Awaited<ReturnType<typeof getCountingData>>,
  userId: string
) => {
  const banMeta = countingData.bannedMeta[userId];
  if (!banMeta) {
    return;
  }

  return {
    name: '🚫 Counting Ban Details',
    value: [
      `**🏠 Guild ID:** ${banMeta.guildId ?? 'Not available'}`,
      `**⏰ Expires At:** ${formatTimestamp(banMeta.expiresAt)}`,
    ].join('\n'),
    inline: false,
  };
};

const USER_INFO_PAGE_DEFINITIONS = [
  {
    key: 'overview' as const,
    label: 'Overview',
    emoji: '📋',
    description: 'Account and server status',
  },
  {
    key: 'moderation' as const,
    label: 'Moderation',
    emoji: '🧑‍💼',
    description: 'Warnings, mutes, and bans',
  },
  {
    key: 'counting' as const,
    label: 'Counting',
    emoji: '🔢',
    description: 'Counting activity and penalties',
  },
] as const;

const USER_INFO_PAGE_COUNT = USER_INFO_PAGE_DEFINITIONS.length;

const USER_INFO_PAGE_SELECT_ID = 'user-info-page-select';

const createUserInfoBaseEmbed = (
  user: Parameters<OptionsCommand['execute']>[0]['user']
) =>
  new EmbedBuilder()
    .setTitle(`User Information - ${user.username}`)
    .setColor(user.accentColor ?? '#5865F2')
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setTimestamp();

const buildUserInfoPageFooter = (
  interaction: Parameters<OptionsCommand['execute']>[0],
  pageIndex: number
) => ({
  text: `Requested by ${interaction.user.username} • Page ${pageIndex}/${USER_INFO_PAGE_COUNT}`,
  iconURL: interaction.user.displayAvatarURL(),
});

const buildOverviewPage = ({
  user,
  memberData,
  interaction,
  countingInfo,
}: {
  user: Parameters<OptionsCommand['execute']>[0]['user'];
  memberData: MemberData | null;
  interaction: Parameters<OptionsCommand['execute']>[0];
  countingInfo: ReturnType<typeof getCountingInfo>;
}): UserInfoPage => {
  const embed = createUserInfoBaseEmbed(user)
    .addFields(
      buildBasicInfoField(user, interaction),
      buildServerRecordField(user, memberData),
      buildQuickStatsField(memberData, countingInfo)
    )
    .setFooter(buildUserInfoPageFooter(interaction, 1));

  return { ...USER_INFO_PAGE_DEFINITIONS[0], embed };
};

const buildModerationPage = ({
  user,
  memberData,
  interaction,
  warningModerations,
  muteModerations,
  banModerations,
  kickModerations,
}: {
  user: Parameters<OptionsCommand['execute']>[0]['user'];
  memberData: MemberData | null;
  interaction: Parameters<OptionsCommand['execute']>[0];
  warningModerations: MemberData['moderations'];
  muteModerations: MemberData['moderations'];
  banModerations: MemberData['moderations'];
  kickModerations: MemberData['moderations'];
}): UserInfoPage => {
  const embed = createUserInfoBaseEmbed(user)
    .addFields(
      buildModerationHistoryField({
        warningModerations,
        muteModerations,
        banModerations,
        kickModerations,
        memberData,
      })
    )
    .setFooter(buildUserInfoPageFooter(interaction, 2));

  if (warningModerations.length > 0) {
    embed.addFields(
      buildRecentModerationsField({
        name: '⚠️ Recent Warnings',
        moderations: warningModerations,
      })
    );
  }

  if (kickModerations.length > 0) {
    embed.addFields(
      buildRecentModerationsField({
        name: '👢 Recent Kicks',
        moderations: kickModerations,
      })
    );
  }

  const currentMuteField = buildCurrentModerationField({
    name: '🔇 Current Mute',
    moderations: muteModerations,
    isActive: memberData?.currentlyMuted ?? false,
    durationFallback: 'Indefinite',
    includeModerator: true,
    timestampLabel: 'Muted At',
  });
  if (currentMuteField) {
    embed.addFields(currentMuteField);
  }

  const currentBanField = buildCurrentModerationField({
    name: '📌 Current Ban',
    moderations: banModerations,
    isActive: memberData?.currentlyBanned ?? false,
    durationFallback: 'Permanent',
    includeModerator: false,
    timestampLabel: 'Banned At',
  });
  if (currentBanField) {
    embed.addFields(currentBanField);
  }

  return { ...USER_INFO_PAGE_DEFINITIONS[1], embed };
};

const buildCountingPage = ({
  user,
  interaction,
  countingData,
  countingInfo,
}: {
  user: Parameters<OptionsCommand['execute']>[0]['user'];
  interaction: Parameters<OptionsCommand['execute']>[0];
  countingData: Awaited<ReturnType<typeof getCountingData>>;
  countingInfo: ReturnType<typeof getCountingInfo>;
}): UserInfoPage => {
  const embed = createUserInfoBaseEmbed(user)
    .addFields(
      buildCountingInfoField(countingInfo),
      buildCountingRoomStatsField(countingData)
    )
    .setFooter(buildUserInfoPageFooter(interaction, 3));

  const countingBanDetailsField = buildCountingBanDetailsField(
    countingData,
    user.id
  );
  if (countingBanDetailsField) {
    embed.addFields(countingBanDetailsField);
  }

  return { ...USER_INFO_PAGE_DEFINITIONS[2], embed };
};

const buildUserInfoPages = ({
  user,
  memberData,
  interaction,
  warningModerations,
  muteModerations,
  banModerations,
  kickModerations,
  countingData,
  countingInfo,
}: {
  user: Parameters<OptionsCommand['execute']>[0]['user'];
  memberData: MemberData | null;
  interaction: Parameters<OptionsCommand['execute']>[0];
  warningModerations: MemberData['moderations'];
  muteModerations: MemberData['moderations'];
  banModerations: MemberData['moderations'];
  kickModerations: MemberData['moderations'];
  countingData: Awaited<ReturnType<typeof getCountingData>>;
  countingInfo: ReturnType<typeof getCountingInfo>;
}): UserInfoPage[] => [
  buildOverviewPage({ user, memberData, interaction, countingInfo }),
  buildModerationPage({
    user,
    memberData,
    interaction,
    warningModerations,
    muteModerations,
    banModerations,
    kickModerations,
  }),
  buildCountingPage({ user, interaction, countingData, countingInfo }),
];

const buildUserInfoPageSelectRow = (
  pages: UserInfoPage[],
  selectedPageKey: (typeof USER_INFO_PAGE_DEFINITIONS)[number]['key']
) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(USER_INFO_PAGE_SELECT_ID)
      .setPlaceholder('Select a page to view')
      .addOptions(
        pages.map((page) => ({
          label: page.label,
          value: page.key,
          description: page.description,
          emoji: page.emoji,
          default: page.key === selectedPageKey,
        }))
      )
  );

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

    if (!user) {
      await safelyRespond(interaction, 'User not found');
      return;
    }

    const memberData = (await getMember(user.id)) ?? null;
    const warningModerations = getSortedModerations(memberData, 'warning');
    const muteModerations = getSortedModerations(memberData, 'mute');
    const banModerations = getSortedModerations(memberData, 'ban');
    const kickModerations = getSortedModerations(memberData, 'kick');
    const countingData = await getCountingData();
    const countingInfo = getCountingInfo(countingData, user.id);

    const pages = buildUserInfoPages({
      user,
      memberData,
      interaction,
      warningModerations,
      muteModerations,
      banModerations,
      kickModerations,
      countingData,
      countingInfo,
    });

    const firstPage = pages[0];
    const message = await interaction.editReply({
      embeds: [firstPage.embed],
      components:
        pages.length > 1
          ? [buildUserInfoPageSelectRow(pages, firstPage.key)]
          : [],
    });

    if (
      pages.length <= 1 ||
      !message ||
      !('createMessageComponentCollector' in message)
    ) {
      return;
    }

    const collector = message.createMessageComponentCollector({
      time: SELECT_TIMEOUT_MS,
      filter: (componentInteraction) =>
        componentInteraction.isStringSelectMenu() &&
        componentInteraction.customId === USER_INFO_PAGE_SELECT_ID,
    });

    collector.on(
      'collect',
      async (componentInteraction: StringSelectMenuInteraction) => {
        if (componentInteraction.user.id !== interaction.user.id) {
          await componentInteraction.reply({
            content: 'You cannot use this page selector.',
            ephemeral: true,
          });
          return;
        }

        const selectedPage = pages.find(
          (page) => page.key === componentInteraction.values[0]
        );

        if (!selectedPage) {
          await componentInteraction.deferUpdate();
          return;
        }

        await componentInteraction.update({
          embeds: [selectedPage.embed],
          components: [buildUserInfoPageSelectRow(pages, selectedPage.key)],
        });
      }
    );

    collector.once('end', async () => {
      await message.edit({ components: [] }).catch(() => null);
    });
  },
};

export default command;
