import {
  ActionRowBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type GuildMember,
  type MessageComponentInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';

import type { SubcommandCommand } from '@/types/CommandTypes.js';
import { loadConfig } from '@/util/configLoader.js';
import {
  MAX_WARNINGS,
  MISTAKE_THRESHOLD,
  WARNING_PERIOD_MS,
} from '@/util/counting/constants.js';
import {
  banUser,
  clearAllMistakes,
  clearStaleWarnings,
  clearUserMistakes,
  getCountingData,
  resetCounting,
  setCount,
  unbanUser,
} from '@/util/counting/countingManager.js';
import type { CountingMistakeInfo } from '@/util/counting/types.js';
import {
  createPaginationButtons,
  formatDuration,
  msToDiscordTimestamp,
  parseDuration,
  safelyRespond,
  safeRemoveComponents,
  validateInteraction,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

async function handleStatus(interaction: ChatInputCommandInteraction) {
  const countingData = await getCountingData();
  const countingChannelId = loadConfig().channels.counting;

  const embed = new EmbedBuilder()
    .setTitle('Counting Channel Status')
    .setColor(0x00_99_ff)
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
      }
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
}

async function handleSetCount(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await safelyRespond(
      interaction,
      'You need administrator permissions to use this command.'
    );
    return;
  }

  const count = interaction.options.getInteger('count');
  if (count === null) {
    await safelyRespond(interaction, 'Invalid count specified.');
    return;
  }

  try {
    await setCount(count);
    await safelyRespond(
      interaction,
      `Count has been set to **${count}**. The next number should be **${count + 1}**.`
    );
  } catch (error) {
    logger.error('[CountingCommand] Error setting count', error);
    await safelyRespond(interaction, 'Failed to set the count', true);
  }
}

async function handleBan(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
    await safelyRespond(
      interaction,
      'Moderation permissions are required to ban users from counting.'
    );
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    return;
  }

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', false);
  const durationStr = interaction.options.getString('duration', false);

  let durationMs: number | undefined;
  if (durationStr) {
    try {
      durationMs = parseDuration(durationStr);
    } catch {
      await safelyRespond(
        interaction,
        'Invalid duration format. Please use formats like 30m, 1h, or 7d (e.g. "1h30m").'
      );
      return;
    }
  }

  const countingData = await getCountingData();

  if (countingData.bannedUsers.includes(user.id)) {
    await safelyRespond(
      interaction,
      `User <@${user.id}> is already banned from counting.`
    );
    return;
  }

  await banUser(
    user.id,
    guild,
    interaction.member as GuildMember,
    reason ?? undefined,
    durationMs
  );

  if (durationMs) {
    await safelyRespond(
      interaction,
      `User <@${user.id}> has been banned from counting for ${durationStr}.`
    );
  } else if (reason) {
    await safelyRespond(
      interaction,
      `User <@${user.id}> has been permanently banned from counting. Reason: ${reason}.`
    );
  } else {
    await safelyRespond(
      interaction,
      `User <@${user.id}> has been permanently banned from counting.`
    );
  }
}

async function handleUnban(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await safelyRespond(
      interaction,
      'Moderation permissions are required to unban users from counting.'
    );
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    return;
  }

  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', false);
  const countingData = await getCountingData();

  if (!countingData.bannedUsers.includes(user.id)) {
    await safelyRespond(
      interaction,
      `User <@${user.id}> is not banned from counting.`
    );
    return;
  }

  await unbanUser(
    user.id,
    guild,
    interaction.member as GuildMember,
    reason ?? undefined
  );

  await safelyRespond(
    interaction,
    `User <@${user.id}> has been unbanned from counting.`
  );
}

async function handleResetData(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await safelyRespond(
      interaction,
      'You need administrator permissions to reset counting data.'
    );
    return;
  }

  try {
    const guild = interaction.guild;
    if (!guild) {
      return;
    }

    const countingChannelId = loadConfig().channels.counting;
    const countingChannel = guild.channels.cache.get(countingChannelId);

    await resetCounting();
    await clearAllMistakes(guild, interaction.member as GuildMember);

    if (countingChannel?.isTextBased()) {
      await countingChannel.send(
        '🔄 Counting data has been reset by an administrator. The count is now back to 0. Start counting again!'
      );
    }

    await safelyRespond(
      interaction,
      'Counting data has been reset (count set to 0) and all counting warnings/mistakes have been cleared.'
    );
  } catch (error) {
    logger.error('[CountingCommand] Error resetting counting data', error);
    await safelyRespond(interaction, 'Failed to reset counting data.');
  }
}

async function handleClearWarnings(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await safelyRespond(
      interaction,
      'Moderation permissions are required to clear counting warnings/mistakes for a user.'
    );
    return;
  }

  const guild = interaction.guild;
  if (!guild) {
    return;
  }

  const user = interaction.options.getUser('user', true);
  try {
    await clearUserMistakes(user.id, guild, interaction.member as GuildMember);
    await safelyRespond(
      interaction,
      `Cleared counting warnings/mistakes for <@${user.id}>.`
    );
  } catch (error) {
    logger.error('[CountingCommand] Error clearing user warnings', error);
    await safelyRespond(
      interaction,
      `Failed to clear warnings for <@${user.id}>.`
    );
  }
}

async function handleListBans(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await safelyRespond(
      interaction,
      'Moderation permissions are required to list counting bans.'
    );
    return;
  }

  const data = await getCountingData();
  const guild = interaction.guild;
  const banned = data.bannedUsers ?? [];

  if (banned.length === 0) {
    await safelyRespond(interaction, 'No active counting bans.');
    return;
  }

  // Resolve all banned user names from cache
  const memberCache = guild?.members.cache ?? new Map();
  const bannedNames: Record<string, string> = {};
  for (const id of banned) {
    const cached = memberCache.get(id);
    bannedNames[id] = cached ? cached.displayName : `<@${id}>`;
  }

  const BANS_PER_PAGE = 10;
  const pages: EmbedBuilder[] = [];

  for (let i = 0; i < banned.length; i += BANS_PER_PAGE) {
    const page = banned.slice(i, i + BANS_PER_PAGE);
    const embed = new EmbedBuilder()
      .setTitle('Active Counting Bans')
      .setDescription(
        `There are **${banned.length}** user(s) currently banned from counting.`
      )
      .setColor(0xff_00_00)
      .setTimestamp()
      .setFooter({ text: 'Permanent = indefinite ban (no expiry set)' });

    const lines: string[] = [];
    for (const id of page) {
      const meta = data.bannedMeta?.[id];
      const name = bannedNames[id] ?? `<@${id}>`;
      if (meta?.expiresAt) {
        lines.push(
          `• **${name}** — expires ${msToDiscordTimestamp(meta.expiresAt)}`
        );
      } else {
        lines.push(`• **${name}** — 🚫 Permanent`);
      }
    }

    embed.setDescription(lines.join('\n'));
    pages.push(embed);
  }

  let currentPage = 0;
  const getSelectRow = () => {
    if (pages.length > 25) {
      return null;
    }

    const options = pages.map((_, index) => ({
      label: `Page ${index + 1}`,
      value: index.toString(),
      default: index === currentPage,
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId('counting_listbans_select')
      .setPlaceholder('Jump to page')
      .addOptions(options);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select
    );
  };

  const selectRow = getSelectRow();
  const components =
    pages.length > 1
      ? [
          createPaginationButtons(pages.length, currentPage),
          ...(selectRow ? [selectRow] : []),
        ]
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

  collector.on('collect', async (i: MessageComponentInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'These controls are not for you!',
        flags: ['Ephemeral'],
      });
      return;
    }

    await i.deferUpdate();

    currentPage = getUpdatedPageFromComponent(i, currentPage, pages.length);

    const updatedSelectRow = getSelectRow();
    const updatedComponents =
      pages.length > 1
        ? [
            createPaginationButtons(pages.length, currentPage),
            ...(updatedSelectRow ? [updatedSelectRow] : []),
          ]
        : [];

    await i.editReply({
      embeds: [pages[currentPage]],
      components: updatedComponents,
    });
  });

  collector.on('end', async () => {
    await safeRemoveComponents(message).catch(() => null);
  });
}

function resolveUserMentions(
  userIds: string[],
  memberCache: Map<string, GuildMember>
): Record<string, string> {
  const mentions: Record<string, string> = {};
  for (const userId of userIds) {
    const cached = memberCache.get(userId);
    mentions[userId] = cached ? cached.user.username : `<@${userId}>`;
  }
  return mentions;
}

function buildWarningPages(
  entries: [string, CountingMistakeInfo][],
  memberMentions: Record<string, string>
): EmbedBuilder[] {
  const WARN_PER_PAGE = 8;
  const pages: EmbedBuilder[] = [];

  for (let i = 0; i < entries.length; i += WARN_PER_PAGE) {
    const slice = entries.slice(i, i + WARN_PER_PAGE);
    const embed = new EmbedBuilder()
      .setTitle('Counting Mistakes & Warnings')
      .setDescription(
        `Tracking **${entries.length}** user(s) with active mistakes or warnings.`
      )
      .setColor(0xff_aa_00)
      .setTimestamp()
      .setFooter({
        text: `Mistakes/warnings expire after ${formatDuration(WARNING_PERIOD_MS)} of inactivity.`,
      });

    if (slice.length === 1) {
      addSingleUserWarningFields(embed, slice[0], memberMentions);
    } else {
      for (const entry of slice) {
        addMultiUserWarningField(embed, entry, memberMentions);
      }
    }

    pages.push(embed);
  }

  return pages;
}

function getRiskIcon(warningsCount: number): string {
  if (warningsCount >= MAX_WARNINGS) {
    return '🔨';
  }
  if (warningsCount >= MAX_WARNINGS - 1) {
    return '⚠️';
  }
  if (warningsCount > 0) {
    return '🔔';
  }
  return '🟢';
}

function getRiskMessage(warningsCount: number): string {
  if (warningsCount >= MAX_WARNINGS) {
    return 'This user has accumulated enough warnings for a temporary ban.';
  }
  return 'One more warning will result in an automatic temporary ban.';
}

function addSingleUserWarningFields(
  embed: EmbedBuilder,
  entry: [string, CountingMistakeInfo],
  memberMentions: Record<string, string>
): void {
  const [userId, info] = entry;
  const mention = memberMentions[userId] || `<@${userId}>`;
  const warningLevel = info.warnings / MAX_WARNINGS;
  const bar = generateWarningBar(warningLevel);

  embed.setDescription(`**${mention}**\n\nTracking mistakes and warnings.`);
  embed.addFields(
    {
      name: 'Mistakes',
      value: `${info.mistakes} / ${MISTAKE_THRESHOLD}`,
      inline: true,
    },
    {
      name: 'Warnings',
      value: `${info.warnings} / ${MAX_WARNINGS}`,
      inline: true,
    },
    { name: 'Warning Progress', value: bar, inline: false }
  );

  const expiresAt = info.lastUpdated + WARNING_PERIOD_MS;
  embed.addFields(
    {
      name: 'Last Updated',
      value: msToDiscordTimestamp(info.lastUpdated),
      inline: true,
    },
    { name: 'Expires', value: msToDiscordTimestamp(expiresAt), inline: true }
  );

  if (info.warnings >= MAX_WARNINGS - 1) {
    embed.addFields({
      name: '⚠️ At Risk',
      value: getRiskMessage(info.warnings),
      inline: false,
    });
  }
}

function addMultiUserWarningField(
  embed: EmbedBuilder,
  entry: [string, CountingMistakeInfo],
  memberMentions: Record<string, string>
): void {
  const [userId, info] = entry;
  const mention = memberMentions[userId] || `<@${userId}>`;
  const warningLevel = info.warnings / MAX_WARNINGS;
  const bar = generateWarningBar(warningLevel);
  const riskIcon = getRiskIcon(info.warnings);

  embed.addFields({
    name: `${riskIcon} ${mention}`,
    value: [
      `Mistakes: \`${info.mistakes}\` / ${MISTAKE_THRESHOLD}`,
      `Warnings: \`${info.warnings}\` / ${MAX_WARNINGS}`,
      `Progress: ${bar}`,
      `Updated: <t:${Math.floor(info.lastUpdated / 1000)}:R>`,
    ].join('\n'),
    inline: true,
  });
}

function generateWarningBar(progress: number): string {
  const TOTAL = 10;
  const FILLED = Math.round(progress * TOTAL);
  const filled = '█'.repeat(FILLED);
  const empty = '░'.repeat(TOTAL - FILLED);
  const pct = Math.round(progress * 100);
  return `\`${filled}${empty}\` ${pct}%`;
}

async function handleListWarnings(interaction: ChatInputCommandInteraction) {
  if (
    !interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)
  ) {
    await safelyRespond(
      interaction,
      'Moderation permissions are required to list counting warnings/mistakes.'
    );
    return;
  }

  await clearStaleWarnings();
  const data = await getCountingData();
  const tracker = data.mistakeTracker ?? {};
  const entries = Object.entries(tracker);

  if (entries.length === 0) {
    await safelyRespond(interaction, 'No counting mistakes/warnings recorded.');
    return;
  }

  const guild = interaction.guild;
  const userIds = entries.map(([userId]) => userId);
  const memberCache = guild?.members.cache ?? new Map();
  const memberMentions = resolveUserMentions(userIds, memberCache);
  const pages = buildWarningPages(entries, memberMentions);

  let currentPage = 0;
  const getSelectRow = () => {
    if (pages.length > 25) {
      return null;
    }

    const options = pages.map((_, index) => ({
      label: `Page ${index + 1}`,
      value: index.toString(),
      default: index === currentPage,
    }));

    const select = new StringSelectMenuBuilder()
      .setCustomId('counting_listwarnings_select')
      .setPlaceholder('Jump to page')
      .addOptions(options);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select
    );
  };

  const selectRowWarnings = getSelectRow();
  const components =
    pages.length > 1
      ? [
          createPaginationButtons(pages.length, currentPage),
          ...(selectRowWarnings ? [selectRowWarnings] : []),
        ]
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

  collector.on('collect', async (i: MessageComponentInteraction) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'These controls are not for you!',
        flags: ['Ephemeral'],
      });
      return;
    }

    await i.deferUpdate();

    currentPage = getUpdatedPageFromComponent(i, currentPage, pages.length);

    const updatedSelectRowWarnings = getSelectRow();
    const updatedComponents =
      pages.length > 1
        ? [
            createPaginationButtons(pages.length, currentPage),
            ...(updatedSelectRowWarnings ? [updatedSelectRowWarnings] : []),
          ]
        : [];

    await i.editReply({
      embeds: [pages[currentPage]],
      components: updatedComponents,
    });
  });

  collector.on('end', async () => {
    await safeRemoveComponents(message).catch(() => null);
  });
}

function getUpdatedPageFromComponent(
  interaction: MessageComponentInteraction,
  currentPage: number,
  length: number
): number {
  if (interaction.isButton()) {
    switch (interaction.customId) {
      case 'first_page':
        return 0;
      case 'prev_page':
        return Math.max(currentPage - 1, 0);
      case 'next_page':
        return Math.min(currentPage + 1, length - 1);
      case 'last_page':
        return length - 1;
      default:
        return currentPage;
    }
  }

  if (interaction.isStringSelectMenu()) {
    const selected = Number.parseInt(interaction.values[0], 10);
    if (!Number.isNaN(selected) && selected >= 0 && selected < length) {
      return selected;
    }
  }

  return currentPage;
}

const subcommandHandlers: Record<
  string,
  (interaction: ChatInputCommandInteraction) => Promise<void>
> = {
  status: handleStatus,
  setcount: handleSetCount,
  ban: handleBan,
  unban: handleUnban,
  resetdata: handleResetData,
  clearwarnings: handleClearWarnings,
  listbans: handleListBans,
  listwarnings: handleListWarnings,
};

const command: SubcommandCommand = {
  data: new SlashCommandBuilder()
    .setName('counting')
    .setDescription('Commands related to the counting channel')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('status')
        .setDescription('Check the current counting status')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('setcount')
        .setDescription(
          '(Admin only) Set the current count to a specific number'
        )
        .addIntegerOption((option) =>
          option
            .setName('count')
            .setDescription('The number to set as the current count')
            .setRequired(true)
            .setMinValue(0)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ban')
        .setDescription('Ban a user from counting')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to ban').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription(
              'Reason for the ban. Leave blank for no reason logged.'
            )
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('duration')
            .setDescription(
              'Duration of the ban (e.g. 30m, 1h, 7d). Leave blank for permanent.'
            )
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('unban')
        .setDescription('Unban a user from counting')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to unban').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription(
              'Reason for the unban. Leave blank for no reason logged.'
            )
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('resetdata')
        .setDescription(
          'Reset counting current count and clear all warnings/mistakes'
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('clearwarnings')
        .setDescription('Clear warnings/mistakes for a user')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to clear warnings for')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('listbans')
        .setDescription('List all users currently banned from counting')
    )
    .addSubcommand((sub) =>
      sub
        .setName('listwarnings')
        .setDescription('List users with counting mistakes/warnings')
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

    const subcommand = interaction.options.getSubcommand();
    const handler = subcommandHandlers[subcommand];

    if (!handler) {
      await interaction.editReply({
        content: 'Unknown counting subcommand.',
      });
      return;
    }

    try {
      await handler(interaction);
    } catch (error) {
      logger.error('[CountingCommand] Subcommand handler failed', error);
      await safelyRespond(
        interaction,
        'An error occurred while processing your request.'
      );
    }
  },
};

export default command;
