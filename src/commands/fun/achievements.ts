import {
  ActionRowBuilder,
  type ButtonInteraction,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

import { getAllAchievements, getUserAchievements } from '@/db/db.js';
import type { achievementDefinitionsTableTypes } from '@/db/schema.js';
import {
  createPaginationButtons,
  safeRemoveComponents,
} from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

// Type for achievement with definition attached
interface AchievementWithDefinition {
  achievementId?: number;
  id?: number;
  discordId?: string;
  progress?: number;
  earnedAt?: Date | null;
  definition?: achievementDefinitionsTableTypes;
  achievementType?: string;
}

// Type for user context in embeds
interface UserContext {
  username: string;
  displayAvatarURL: () => string;
}

const command = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View progress towards server achievements')
    .addUserOption((option) =>
      option
        .setName('user')
        .setDescription('The user to view achievements for')
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply();
    const targetUser = interaction.options.getUser('user') ?? interaction.user;

    try {
      const userAchievements = await getUserAchievements(targetUser.id);
      const allAchievements = await getAllAchievements();

      const totalAchievements = allAchievements.length;
      const earnedCount = userAchievements.filter(
        (ua) =>
          ua.earnedAt &&
          ua.earnedAt !== null &&
          ua.earnedAt !== undefined &&
          new Date(ua.earnedAt).getTime() > 0,
      ).length;
      const overallProgress =
        totalAchievements > 0
          ? Math.round((earnedCount / totalAchievements) * 100)
          : 0;

      if (totalAchievements === 0) {
        await interaction.editReply(
          'No achievements have been created on this server yet.',
        );
        return;
      }

      const earnedAchievements = userAchievements
        .filter((ua) => {
          return (
            ua.earnedAt &&
            ua.earnedAt !== null &&
            ua.earnedAt !== undefined &&
            new Date(ua.earnedAt).getTime() > 0
          );
        })
        .map((ua) => {
          const achievementDef = allAchievements.find(
            (a) => a.id === ua.achievementId,
          );
          return {
            ...ua,
            definition: achievementDef,
          };
        })
        .filter((a) => a.definition);

      const inProgressAchievements = userAchievements
        .filter((ua) => {
          return (
            (!ua.earnedAt || ua.earnedAt === null || ua.earnedAt === undefined || new Date(ua.earnedAt).getTime() <= 0) &&
            (ua.progress ?? 0) > 0
          );
        })
        .map((ua) => {
          const achievementDef = allAchievements.find(
            (a) => a.id === ua.achievementId,
          );
          return {
            ...ua,
            definition: achievementDef,
          };
        })
        .filter((a) => a.definition);

      const earnedAndInProgressIds = new Set(
        userAchievements
          .filter(
            (ua) =>
              (ua.progress ?? 0) > 0 || (ua.earnedAt && new Date(ua.earnedAt).getTime() > 0),
          )
          .map((ua) => ua.achievementId),
      );
      const availableAchievements = allAchievements
        .filter((a) => !earnedAndInProgressIds.has(a.id))
        .map((definition) => {
          const existingEntry = userAchievements.find(
            (ua) =>
              ua.achievementId === definition.id &&
              (ua.progress === 0 || ua.progress === null),
          );

          return {
            achievementId: definition.id,
            progress: existingEntry?.progress ?? 0,
            definition,
          };
        });

      interface AchievementViewOption {
        label: string;
        value: string;
        count: number;
      }

      const options: AchievementViewOption[] = [];

      if (earnedAchievements.length > 0) {
        options.push({
          label: 'Earned Achievements',
          value: 'earned',
          count: earnedAchievements.length,
        });
      }

      if (inProgressAchievements.length > 0) {
        options.push({
          label: 'In Progress',
          value: 'progress',
          count: inProgressAchievements.length,
        });
      }

      if (availableAchievements.length > 0) {
        options.push({
          label: 'Available Achievements',
          value: 'available',
          count: availableAchievements.length,
        });
      }

      if (options.length === 0) {
        await interaction.editReply('No achievement data found.');
        return;
      }

      let initialOption = options[0].value;
      for (const preferredType of ['earned', 'progress', 'available']) {
        const found = options.find((opt) => opt.value === preferredType);
        if (found) {
          initialOption = preferredType;
          break;
        }
      }

      // currentView preserves the user's selected view (earned/progress/available)
      let currentView = initialOption;

      const getEmbedDataForView = (view: string) => {
        if (view === 'earned') {
          return {
            achievements: earnedAchievements,
            title: 'Earned Achievements',
          };
        }
        if (view === 'progress') {
          return {
            achievements: inProgressAchievements,
            title: 'Achievements In Progress',
          };
        }
        return {
          achievements: availableAchievements,
          title: 'Available Achievements',
        };
      };

      const buildSelectMenu = (selectedValue: string) =>
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('achievement_view')
            .setPlaceholder('Select achievement type')
            .addOptions(
              options.map((opt) =>
                new StringSelectMenuOptionBuilder()
                  .setLabel(`${opt.label} (${opt.count})`)
                  .setValue(opt.value)
                  .setDefault(opt.value === selectedValue),
              ),
            ),
        );

      // Define pagination variables
      const achievementsPerPage = 5;
      let currentPage = 0;

      const currentEmbedData = getEmbedDataForView(currentView);
      let pages = splitAchievementsIntoPages(
        currentEmbedData.achievements,
        currentEmbedData.title,
        targetUser,
        overallProgress,
        earnedCount,
        totalAchievements,
        achievementsPerPage,
      );

      // Build select menu using currentView so it can be preserved across rerenders
      let selectMenu = buildSelectMenu(currentView);

      // Create pagination buttons
      const paginationRow = createPaginationButtons(pages.length, currentPage);

      const components: (
        | ActionRowBuilder<StringSelectMenuBuilder>
        | ActionRowBuilder<ButtonBuilder>
      )[] = pages.length > 1 ? [selectMenu, paginationRow] : [];

      const message = await interaction.editReply({
        embeds: [pages[currentPage]],
        components,
      });

      // If there are no components, don't start collectors / return early.
      if (components.length === 0) return;

      // Create collector for both select menu and button interactions
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      const buttonCollector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on('collect', async (i: StringSelectMenuInteraction) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: 'You cannot use these buttons.',
            flags: ['Ephemeral'],
          });
          return;
        }

        await i.deferUpdate();

        const selected = i.values[0];
        // update currentView and rebuild pages & select menu from that view
        currentView = selected;
        const newEmbedData = getEmbedDataForView(currentView);
        currentPage = 0;
        pages = splitAchievementsIntoPages(
          newEmbedData.achievements,
          newEmbedData.title,
          targetUser,
          overallProgress,
          earnedCount,
          totalAchievements,
          achievementsPerPage,
        );

        selectMenu = buildSelectMenu(currentView);
        const updatedPaginationRow = createPaginationButtons(
          pages.length,
          currentPage,
        );

        await i.editReply({
          embeds: [pages[currentPage]],
          components: [
            selectMenu,
            ...(pages.length > 1 ? [updatedPaginationRow] : []),
          ],
        });
      });

      buttonCollector.on('collect', async (i: ButtonInteraction) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: 'You cannot use these buttons.',
            flags: ['Ephemeral'],
          });
          return;
        }

        await i.deferUpdate();

        if (i.customId === 'first_page') {
          currentPage = 0;
        } else if (i.customId === 'prev_page') {
          currentPage = Math.max(0, currentPage - 1);
        } else if (i.customId === 'next_page') {
          currentPage = Math.min(pages.length - 1, currentPage + 1);
        } else if (i.customId === 'last_page') {
          currentPage = pages.length - 1;
        }

        // preserve currentView when updating pagination UI
        const updatedPaginationRow = createPaginationButtons(
          pages.length,
          currentPage,
        );

        await i.editReply({
          embeds: [pages[currentPage]],
          components: [
            ...(options.length > 1 ? [buildSelectMenu(currentView)] : []),
            ...(pages.length > 1 ? [updatedPaginationRow] : []),
          ],
        });
      });

      collector.on('end', () => {
        buttonCollector.stop();
      });

      buttonCollector.on('end', async () => {
        await safeRemoveComponents(message).catch(() => null);
      });
    } catch (error) {
      logger.error(
        '[AchievementCommand] Error viewing user achievements',
        error,
      );
      await interaction.editReply(
        'An error occurred while fetching user achievements.',
      );
    }
  },
};

/**
 * Splits achievements into pages for pagination
 * @param achievements - List of achievements to paginate
 * @param title - Title of the embed
 * @param user - User whose achievements are being displayed
 * @param overallProgress - Overall achievement progress percentage
 * @param earnedCount - Number of achievements earned
 * @param totalAchievements - Total number of achievements
 * @param achievementsPerPage - Number of achievements to show per page
 * @returns An array of EmbedBuilder instances, each representing a page
 */
function splitAchievementsIntoPages(
  achievements: AchievementWithDefinition[],
  title: string,
  user: UserContext,
  overallProgress = 0,
  earnedCount = 0,
  totalAchievements = 0,
  achievementsPerPage = 5,
): EmbedBuilder[] {
  if (achievements.length === 0) {
    return [
      createAchievementsEmbed(
        achievements,
        title,
        user,
        overallProgress,
        earnedCount,
        totalAchievements,
      ),
    ];
  }

  const groupedAchievements: Record<string, typeof achievements> = {
    message_count: achievements.filter(
      (a) => a.definition?.requirementType === 'message_count',
    ),
    level: achievements.filter(
      (a) => a.definition?.requirementType === 'level',
    ),
    command_usage: achievements.filter(
      (a) => a.definition?.requirementType === 'command_usage',
    ),
    reactions: achievements.filter(
      (a) => a.definition?.requirementType === 'reactions',
    ),
    other: achievements.filter(
      (a) =>
        !['message_count', 'level', 'command_usage', 'reactions'].includes(
          a.definition?.requirementType ?? '',
        ),
    ),
  };

  let orderedAchievements: typeof achievements = [];
  for (const [type, typeAchievements] of Object.entries(groupedAchievements)) {
    if (typeAchievements.length > 0) {
      orderedAchievements = orderedAchievements.concat(
        typeAchievements.map((ach) => ({
          ...ach,
          achievementType: type,
        })),
      );
    }
  }

  const chunks: (typeof achievements)[] = [];
  for (let i = 0; i < orderedAchievements.length; i += achievementsPerPage) {
    chunks.push(orderedAchievements.slice(i, i + achievementsPerPage));
  }

  return chunks.map((chunk, index) => {
    return createPageEmbed(
      chunk,
      title,
      user,
      overallProgress,
      earnedCount,
      totalAchievements,
      index + 1,
      chunks.length,
    );
  });
}

/**
 * Creates an embed for a single page of achievements
 * @param achievements - Achievements to display on this page
 * @param title - Title of the embed
 * @param user - User whose achievements are being displayed
 * @param overallProgress - Overall achievement progress percentage
 * @param earnedCount - Number of achievements earned
 * @param totalAchievements - Total number of achievements
 * @param pageNumber - Current page number
 * @param totalPages - Total number of pages
 * @returns An EmbedBuilder instance representing the page
 */
function createPageEmbed(
  achievements: AchievementWithDefinition[],
  title: string,
  user: UserContext,
  overallProgress = 0,
  earnedCount = 0,
  totalAchievements = 0,
  pageNumber = 1,
  totalPages = 1,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(`${user.username}'s ${title}`)
    .setThumbnail(user.displayAvatarURL())
    .setFooter({ text: `Page ${pageNumber}/${totalPages}` });

  if (achievements.length === 0) {
    embed.setDescription('No achievements found.');
    return embed;
  }

  let currentType: string | null = null;

  achievements.forEach((achievement) => {
    const { definition, achievementType } = achievement;
    if (!definition) return;

    if (achievementType && achievementType !== currentType) {
      currentType = achievementType;
      embed.addFields({
        name: `${formatType(currentType ?? '')} Achievements`,
        value: '⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯',
      });
    }

    let fieldValue = definition.description;

    if (
      achievement.earnedAt &&
      achievement.earnedAt !== null &&
      achievement.earnedAt !== undefined &&
      new Date(achievement.earnedAt).getTime() > 0
    ) {
      const earnedDate = new Date(achievement.earnedAt);
      fieldValue += `\n✅ **Completed**: <t:${Math.floor(earnedDate.getTime() / 1000)}:R>`;
    } else {
      const progress = achievement.progress ?? 0;
      const progressBar = createProgressBar(progress);
      fieldValue += `\n${progressBar} **${progress}%**`;

      if (definition.requirementType === 'message_count') {
        fieldValue += `\n📨 Send ${definition.threshold} messages`;
      } else if (definition.requirementType === 'level') {
        fieldValue += `\n🏆 Reach level ${definition.threshold}`;
      } else if (definition.requirementType === 'command_usage') {
        const cmdName =
          (definition.requirement as { command?: string } | null)?.command ??
          'unknown';
        fieldValue += `\n🔧 Use /${cmdName} command`;
      } else if (definition.requirementType === 'reactions') {
        fieldValue += `\n😀 Add ${definition.threshold} reactions`;
      }
    }

    if (definition.rewardType && definition.rewardValue) {
      fieldValue += `\n💰 **Reward**: ${
        definition.rewardType === 'xp'
          ? `${definition.rewardValue} XP`
          : `Role <@&${definition.rewardValue}>`
      }`;
    }

    embed.addFields({
      name: definition.name,
      value: fieldValue,
    });
  });

  embed.addFields({
    name: '📊 Overall Achievement Progress',
    value:
      `${createProgressBar(overallProgress)} **${overallProgress}%**\n` +
      `You've earned **${earnedCount}** of ${totalAchievements} achievements`,
  });

  return embed;
}

/**
 * Creates a visual progress bar
 * @param progress - Number between 0-100
 * @returns A string representing a progress bar
 */
function createProgressBar(progress: number): string {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const filledBars = Math.round(clampedProgress / 10);
  const emptyBars = 10 - filledBars;

  const filled = '█'.repeat(filledBars);
  const empty = '░'.repeat(emptyBars);

  return `[${filled}${empty}]`;
}

/**
 * Formats the achievement type for display
 * @param type - achievement type string
 * @returns Formatted achievement type string
 */
function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
}

/**
 * Create an embed representing a user's achievements list.
 * @param achievements - Array of achievement objects to render in the embed.
 * @param title - Title to display at the top of the embed.
 * @param user - User context (e.g. a user object or mention) the embed is associated with.
 * @param overallProgress - Numeric overall progress value (e.g. percentage) for the achievements. Defaults to `0`.
 * @param earnedCount - Number of achievements the user has earned. Defaults to `0`.
 * @param totalAchievements - Total number of achievements available. Defaults to `0`.
 * @returns The constructed embed (or embed-like object) ready to be sent to Discord. The function delegates to `createPageEmbed` and configures it for a single page.
 */
function createAchievementsEmbed(
  achievements: AchievementWithDefinition[],
  title: string,
  user: UserContext,
  overallProgress = 0,
  earnedCount = 0,
  totalAchievements = 0,
) {
  return createPageEmbed(
    achievements,
    title,
    user,
    overallProgress,
    earnedCount,
    totalAchievements,
    1,
    1,
  );
}

export default command;
