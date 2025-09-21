import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  ComponentType,
  ButtonInteraction,
} from 'discord.js';

import {
  getAllAchievements,
  getUserAchievements,
  createAchievement,
  deleteAchievement,
  removeUserAchievement,
  updateAchievementProgress,
} from '@/db/db.js';
import { announceAchievement } from '@/util/achievementManager.js';
import { createPaginationButtons } from '@/util/helpers.js';

const command = {
  data: new SlashCommandBuilder()
    .setName('achievement')
    .setDescription('Manage server achievements')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new achievement')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the achievement')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description of the achievement')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('requirement_type')
            .setDescription('Type of requirement for this achievement')
            .setRequired(true)
            .addChoices(
              { name: 'Message Count', value: 'message_count' },
              { name: 'Level', value: 'level' },
              { name: 'Reactions', value: 'reactions' },
              { name: 'Command Usage', value: 'command_usage' },
            ),
        )
        .addIntegerOption((option) =>
          option
            .setName('threshold')
            .setDescription('Threshold value for completing the achievement')
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName('image_url')
            .setDescription('URL for the achievement image (optional)')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('command_name')
            .setDescription('Command name (only for command_usage type)')
            .setRequired(false),
        )
        .addStringOption((option) =>
          option
            .setName('reward_type')
            .setDescription('Type of reward (optional)')
            .setRequired(false)
            .addChoices(
              { name: 'XP', value: 'xp' },
              { name: 'Role', value: 'role' },
            ),
        )
        .addStringOption((option) =>
          option
            .setName('reward_value')
            .setDescription('Value of the reward (XP amount or role ID)')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete an achievement')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID of the achievement to delete')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('award')
        .setDescription('Award an achievement to a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to award the achievement to')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('achievement_id')
            .setDescription('ID of the achievement to award')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View a users achievements')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to view achievements for')
            .setRequired(false),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('unaward')
        .setDescription('Remove an achievement from a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to remove the achievement from')
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName('achievement_id')
            .setDescription('ID of the achievement to remove')
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand() || !interaction.guild) return;

    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreateAchievement(interaction);
        break;
      case 'delete':
        await handleDeleteAchievement(interaction);
        break;
      case 'award':
        await handleAwardAchievement(interaction);
        break;
      case 'unaward':
        await handleUnawardAchievement(interaction);
        break;
      case 'view':
        await handleViewUserAchievements(interaction);
        break;
    }
  },
};

async function handleCreateAchievement(
  interaction: ChatInputCommandInteraction,
) {
  const name = interaction.options.getString('name')!;
  const description = interaction.options.getString('description')!;
  const imageUrl = interaction.options.getString('image_url');
  const requirementType = interaction.options.getString('requirement_type')!;
  const threshold = interaction.options.getInteger('threshold')!;
  const commandName = interaction.options.getString('command_name');
  const rewardType = interaction.options.getString('reward_type');
  const rewardValue = interaction.options.getString('reward_value');

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply(
      'You do not have permission to create achievements.',
    );
    return;
  }

  if (requirementType === 'command_usage' && !commandName) {
    await interaction.editReply(
      'Command name is required for command_usage type achievements.',
    );
    return;
  }

  if (rewardType && !rewardValue) {
    await interaction.editReply(
      `Reward value is required when setting a ${rewardType} reward.`,
    );
    return;
  }

  const requirement: any = {};
  if (requirementType === 'command_usage' && commandName) {
    requirement.command = commandName;
  }

  try {
    const achievement = await createAchievement({
      name,
      description,
      imageUrl: imageUrl || undefined,
      requirementType,
      threshold,
      requirement,
      rewardType: rewardType || undefined,
      rewardValue: rewardValue || undefined,
    });

    if (achievement) {
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('Achievement Created')
        .setDescription(`Successfully created achievement: **${name}**`)
        .addFields(
          { name: 'ID', value: `${achievement.id}`, inline: true },
          { name: 'Type', value: requirementType, inline: true },
          { name: 'Threshold', value: `${threshold}`, inline: true },
          { name: 'Description', value: description },
        );

      if (rewardType && rewardValue) {
        embed.addFields({
          name: 'Reward',
          value: `${rewardType === 'xp' ? `${rewardValue} XP` : `<@&${rewardValue}>`}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply('Failed to create achievement.');
    }
  } catch (error) {
    console.error('Error creating achievement:', error);
    await interaction.editReply(
      'An error occurred while creating the achievement.',
    );
  }
}

async function handleDeleteAchievement(
  interaction: ChatInputCommandInteraction,
) {
  const achievementId = interaction.options.getInteger('id')!;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply(
      'You do not have permission to delete achievements.',
    );
    return;
  }

  try {
    const success = await deleteAchievement(achievementId);

    if (success) {
      await interaction.editReply(
        `Achievement with ID ${achievementId} has been deleted.`,
      );
    } else {
      await interaction.editReply(
        `Failed to delete achievement with ID ${achievementId}.`,
      );
    }
  } catch (error) {
    console.error('Error deleting achievement:', error);
    await interaction.editReply(
      'An error occurred while deleting the achievement.',
    );
  }
}

async function handleAwardAchievement(
  interaction: ChatInputCommandInteraction,
) {
  const user = interaction.options.getUser('user')!;
  const achievementId = interaction.options.getInteger('achievement_id')!;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply(
      'You do not have permission to award achievements.',
    );
    return;
  }

  try {
    const allAchievements = await getAllAchievements();
    const achievement = allAchievements.find((a) => a.id === achievementId);

    if (!achievement) {
      await interaction.editReply(
        `Achievement with ID ${achievementId} not found.`,
      );
      return;
    }

    const success = await updateAchievementProgress(
      user.id,
      achievementId,
      100,
    );

    if (success) {
      await announceAchievement(interaction.guild!, user.id, achievement);
      await interaction.editReply(
        `Achievement "${achievement.name}" awarded to ${user}.`,
      );
    } else {
      await interaction.editReply(
        'Failed to award achievement or user already has this achievement.',
      );
    }
  } catch (error) {
    console.error('Error awarding achievement:', error);
    await interaction.editReply(
      'An error occurred while awarding the achievement.',
    );
  }
}

async function handleViewUserAchievements(
  interaction: ChatInputCommandInteraction,
) {
  const targetUser = interaction.options.getUser('user') || interaction.user;

  try {
    const userAchievements = await getUserAchievements(targetUser.id);
    const allAchievements = await getAllAchievements();

    const totalAchievements = allAchievements.length;
    const earnedCount = userAchievements.filter((ua) => ua.earnedAt).length;
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
          (!ua.earnedAt ||
            ua.earnedAt === null ||
            ua.earnedAt === undefined ||
            new Date(ua.earnedAt).getTime() <= 0) &&
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
            (ua.progress ?? 0) > 0 ||
            (ua.earnedAt && new Date(ua.earnedAt).getTime() > 0),
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
          progress: existingEntry?.progress || 0,
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

    const initialEmbedData =
      initialOption === 'earned'
        ? { achievements: earnedAchievements, title: 'Earned Achievements' }
        : initialOption === 'progress'
          ? {
              achievements: inProgressAchievements,
              title: 'Achievements In Progress',
            }
          : {
              achievements: availableAchievements,
              title: 'Available Achievements',
            };

    // Define pagination variables
    const achievementsPerPage = 5;
    let currentPage = 0;

    const pages = splitAchievementsIntoPages(
      initialEmbedData.achievements,
      initialEmbedData.title,
      targetUser,
      overallProgress,
      earnedCount,
      totalAchievements,
      achievementsPerPage,
    );

    // Create achievements type selector
    const selectMenu =
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('achievement_view')
          .setPlaceholder('Select achievement type')
          .addOptions(
            options.map((opt) =>
              new StringSelectMenuOptionBuilder()
                .setLabel(`${opt.label} (${opt.count})`)
                .setValue(opt.value)
                .setDefault(opt.value === initialOption),
            ),
          ),
      );

    // Create pagination buttons
    const paginationRow = createPaginationButtons(pages.length, currentPage);

    const message = await interaction.editReply({
      embeds: [pages[currentPage]],
      components: [selectMenu, ...(pages.length > 1 ? [paginationRow] : [])],
    });

    if (options.length <= 1 && pages.length <= 1) return;

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
          content: 'You cannot use this menu.',
          ephemeral: true,
        });
        return;
      }

      await i.deferUpdate();

      const selected = i.values[0];
      let categoryPages;

      if (selected === 'earned') {
        categoryPages = splitAchievementsIntoPages(
          earnedAchievements,
          'Earned Achievements',
          targetUser,
          overallProgress,
          earnedCount,
          totalAchievements,
          achievementsPerPage,
        );
      } else if (selected === 'progress') {
        categoryPages = splitAchievementsIntoPages(
          inProgressAchievements,
          'Achievements In Progress',
          targetUser,
          overallProgress,
          earnedCount,
          totalAchievements,
          achievementsPerPage,
        );
      } else if (selected === 'available') {
        categoryPages = splitAchievementsIntoPages(
          availableAchievements,
          'Available Achievements',
          targetUser,
          overallProgress,
          earnedCount,
          totalAchievements,
          achievementsPerPage,
        );
      }

      if (categoryPages && categoryPages.length > 0) {
        currentPage = 0;
        pages.splice(0, pages.length, ...categoryPages);

        const updatedSelectMenu =
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('achievement_view')
              .setPlaceholder('Select achievement type')
              .addOptions(
                options.map((opt) =>
                  new StringSelectMenuOptionBuilder()
                    .setLabel(`${opt.label} (${opt.count})`)
                    .setValue(opt.value)
                    .setDefault(opt.value === selected),
                ),
              ),
          );

        const updatedPaginationRow = createPaginationButtons(
          pages.length,
          currentPage,
        );

        await i.editReply({
          embeds: [pages[currentPage]],
          components: [
            updatedSelectMenu,
            ...(pages.length > 1 ? [updatedPaginationRow] : []),
          ],
        });
      }
    });

    buttonCollector.on('collect', async (i: ButtonInteraction) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({
          content: 'You cannot use these buttons.',
          ephemeral: true,
        });
        return;
      }

      await i.deferUpdate();

      if (i.customId === 'first') {
        currentPage = 0;
      } else if (i.customId === 'prev') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId === 'next') {
        currentPage = Math.min(pages.length - 1, currentPage + 1);
      } else if (i.customId === 'last') {
        currentPage = pages.length - 1;
      }

      const updatedPaginationRow = createPaginationButtons(
        pages.length,
        currentPage,
      );

      await i.editReply({
        embeds: [pages[currentPage]],
        components: [selectMenu, updatedPaginationRow],
      });
    });

    collector.on('end', () => {
      buttonCollector.stop();
    });

    buttonCollector.on('end', () => {
      interaction.editReply({ components: [] }).catch((err) => {
        console.error('Failed to edit reply after collector ended.', err);
      });
    });
  } catch (error) {
    console.error('Error viewing user achievements:', error);
    await interaction.editReply(
      'An error occurred while fetching user achievements.',
    );
  }
}

/**
 * Handle removing an achievement from a user
 */
async function handleUnawardAchievement(
  interaction: ChatInputCommandInteraction,
) {
  const user = interaction.options.getUser('user')!;
  const achievementId = interaction.options.getInteger('achievement_id')!;

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply(
      'You do not have permission to unaward achievements.',
    );
    return;
  }

  try {
    const allAchievements = await getAllAchievements();
    const achievement = allAchievements.find((a) => a.id === achievementId);

    if (!achievement) {
      await interaction.editReply(
        `Achievement with ID ${achievementId} not found.`,
      );
      return;
    }

    const userAchievements = await getUserAchievements(user.id);
    const earnedAchievement = userAchievements.find(
      (ua) => ua.achievementId === achievementId && ua.earnedAt !== null,
    );

    if (!earnedAchievement) {
      await interaction.editReply(
        `${user.username} has not earned the achievement "${achievement.name}".`,
      );
      return;
    }

    const success = await removeUserAchievement(user.id, achievementId);

    if (success) {
      await interaction.editReply(
        `Achievement "${achievement.name}" has been removed from ${user.username}.`,
      );

      if (achievement.rewardType === 'role' && achievement.rewardValue) {
        try {
          const member = await interaction.guild!.members.fetch(user.id);
          await member.roles.remove(achievement.rewardValue);
        } catch (err) {
          console.error(
            `Failed to remove role ${achievement.rewardValue} from user ${user.id}`,
            err,
          );
          await interaction.followUp({
            content:
              'Note: Failed to remove the role reward. Please check permissions and remove it manually if needed.',
            ephemeral: true,
          });
        }
      }
    } else {
      await interaction.editReply(
        `Failed to remove achievement "${achievement.name}" from ${user.username}.`,
      );
    }
  } catch (error) {
    console.error('Error removing achievement from user:', error);
    await interaction.editReply(
      'An error occurred while removing the achievement.',
    );
  }
}

function createAchievementsEmbed(
  achievements: Array<any>,
  title: string,
  user: any,
  overallProgress: number = 0,
  earnedCount: number = 0,
  totalAchievements: number = 0,
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

/**
 * Creates a visual progress bar
 * @param progress - Number between 0-100
 * @returns A string representing a progress bar
 */
function createProgressBar(progress: number): string {
  const filledBars = Math.round(progress / 10);
  const emptyBars = 10 - filledBars;

  const filled = '█'.repeat(filledBars);
  const empty = '░'.repeat(emptyBars);

  return `[${filled}${empty}]`;
}

function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
}

/**
 * Splits achievements into pages for pagination
 */
function splitAchievementsIntoPages(
  achievements: Array<any>,
  title: string,
  user: any,
  overallProgress: number = 0,
  earnedCount: number = 0,
  totalAchievements: number = 0,
  achievementsPerPage: number = 5,
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
          a.definition?.requirementType,
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
 */
function createPageEmbed(
  achievements: Array<any>,
  title: string,
  user: any,
  overallProgress: number = 0,
  earnedCount: number = 0,
  totalAchievements: number = 0,
  pageNumber: number = 1,
  totalPages: number = 1,
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
        name: `${formatType(currentType || '')} Achievements`,
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
      const progress = achievement.progress || 0;
      const progressBar = createProgressBar(progress);
      fieldValue += `\n${progressBar} **${progress}%**`;

      if (definition.requirementType === 'message_count') {
        fieldValue += `\n📨 Send ${definition.threshold} messages`;
      } else if (definition.requirementType === 'level') {
        fieldValue += `\n🏆 Reach level ${definition.threshold}`;
      } else if (definition.requirementType === 'command_usage') {
        const cmdName = definition.requirement?.command || 'unknown';
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

export default command;
