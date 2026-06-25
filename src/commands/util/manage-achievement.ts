import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

const POSITIVE_INTEGER_REGEX = /^\d+$/u;

import {
  createAchievement,
  deleteAchievement,
  getAllAchievements,
  getUserAchievements,
  removeUserAchievement,
  updateAchievementProgress,
} from '@/db/db.js';
import { announceAchievement } from '@/util/achievementManager.js';
import { safelyRespond, validateInteraction } from '@/util/helpers.js';
import { logger } from '@/util/logger.js';

const command = {
  data: new SlashCommandBuilder()
    .setName('manage-achievements')
    .setDescription('Manage server achievements')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new achievement')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Name of the achievement')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description of the achievement')
            .setRequired(true)
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
              { name: 'Command Usage', value: 'command_usage' }
            )
        )
        .addIntegerOption((option) =>
          option
            .setName('threshold')
            .setDescription('Threshold value for completing the achievement')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('image_url')
            .setDescription('URL for the achievement image (optional)')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('command_name')
            .setDescription('Command name (only for command_usage type)')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('reward_type')
            .setDescription('Type of reward (optional)')
            .setRequired(false)
            .addChoices(
              { name: 'XP', value: 'xp' },
              { name: 'Role', value: 'role' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('reward_value')
            .setDescription('Value of the reward (XP amount or role ID)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete an achievement')
        .addIntegerOption((option) =>
          option
            .setName('id')
            .setDescription('ID of the achievement to delete')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('award')
        .setDescription('Award an achievement to a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to award the achievement to')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('achievement_id')
            .setDescription('ID of the achievement to award')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('unaward')
        .setDescription('Remove an achievement from a user')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('User to remove the achievement from')
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('achievement_id')
            .setDescription('ID of the achievement to remove')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
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
      default:
        await safelyRespond(
          interaction,
          `Unknown subcommand: \`${subcommand}\``
        );
    }
  },
};

async function handleCreateAchievement(
  interaction: ChatInputCommandInteraction
) {
  const name = interaction.options.getString('name', true);
  const description = interaction.options.getString('description', true);
  const imageUrl = interaction.options.getString('image_url');
  const requirementType = interaction.options.getString(
    'requirement_type',
    true
  );
  const threshold = interaction.options.getInteger('threshold', true);
  const commandName = interaction.options.getString('command_name');
  const rewardType = interaction.options.getString('reward_type');
  const rewardValue = interaction.options.getString('reward_value');

  const validationError = validateCreateAchievementInputs({
    threshold,
    requirementType,
    commandName,
    rewardType,
    rewardValue,
  });

  if (validationError) {
    await safelyRespond(interaction, validationError);
    return;
  }

  const requirement = buildAchievementRequirement(requirementType, commandName);

  try {
    const achievement = await createAchievement({
      name,
      description,
      imageUrl: imageUrl ?? undefined,
      requirementType,
      threshold,
      requirement,
      rewardType: rewardType ?? undefined,
      rewardValue: rewardValue ?? undefined,
    });

    if (achievement) {
      const embed = new EmbedBuilder()
        .setColor(0x00_ff_00)
        .setTitle('Achievement Created')
        .setDescription(`Successfully created achievement: **${name}**`)
        .addFields(
          { name: 'ID', value: `${achievement.id}`, inline: true },
          { name: 'Type', value: requirementType, inline: true },
          { name: 'Threshold', value: `${threshold}`, inline: true },
          { name: 'Description', value: description }
        );

      if (rewardType && rewardValue) {
        embed.addFields({
          name: 'Reward',
          value: `${rewardType === 'xp' ? `${rewardValue} XP` : `<@&${rewardValue}>`}`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } else {
      await safelyRespond(interaction, 'Failed to create achievement.');
    }
  } catch (error) {
    logger.error(
      '[ManageAchievementCommand] Error creating achievement',
      error
    );
    await safelyRespond(
      interaction,
      'An error occurred while creating the achievement.'
    );
  }
}

function validateCreateAchievementInputs(params: {
  threshold: number | null;
  requirementType: string | null;
  commandName: string | null;
  rewardType: string | null;
  rewardValue: string | null;
}): string | undefined {
  const { threshold, requirementType, commandName, rewardType, rewardValue } =
    params;

  if (!Number.isFinite(threshold ?? Number.NaN) || (threshold ?? 0) <= 0) {
    return 'Threshold must be a positive integer.';
  }

  if (requirementType === 'command_usage' && !commandName) {
    return 'Command name is required for command_usage type achievements.';
  }

  if (rewardType && !rewardValue) {
    return `Reward value is required when setting a ${rewardType} reward.`;
  }

  if (
    rewardType === 'xp' &&
    rewardValue &&
    (!POSITIVE_INTEGER_REGEX.test(rewardValue) || Number(rewardValue) <= 0)
  ) {
    return 'Reward XP must be a positive integer.';
  }

  return;
}

function buildAchievementRequirement(
  requirementType: string | null,
  commandName: string | null
): Record<string, string> {
  if (requirementType === 'command_usage' && commandName) {
    return { command: commandName };
  }

  return {};
}

async function handleDeleteAchievement(
  interaction: ChatInputCommandInteraction
) {
  const achievementId = interaction.options.getInteger('id', true);

  try {
    const success = await deleteAchievement(achievementId);

    if (success) {
      await safelyRespond(
        interaction,
        `Achievement with ID ${achievementId} has been deleted.`
      );
    } else {
      await safelyRespond(
        interaction,
        `Failed to delete achievement with ID ${achievementId}.`
      );
    }
  } catch (error) {
    logger.error(
      '[ManageAchievementCommand] Error deleting achievement',
      error
    );
    await safelyRespond(
      interaction,
      'An error occurred while deleting the achievement.'
    );
  }
}

async function handleAwardAchievement(
  interaction: ChatInputCommandInteraction
) {
  const { guild } = interaction;

  if (!guild) {
    await safelyRespond(
      interaction,
      'This command can only be used in a server.'
    );
    return;
  }

  const user = interaction.options.getUser('user', true);
  const achievementId = interaction.options.getInteger('achievement_id', true);

  try {
    const allAchievements = await getAllAchievements();
    const achievement = allAchievements.find((a) => a.id === achievementId);

    if (!achievement) {
      await safelyRespond(
        interaction,
        `Achievement with ID ${achievementId} not found.`
      );
      return;
    }

    const success = await updateAchievementProgress(
      user.id,
      achievementId,
      100
    );

    if (success) {
      await announceAchievement(guild, user.id, achievement);
      await safelyRespond(
        interaction,
        `Achievement "${achievement.name}" awarded to ${user}.`
      );
    } else {
      await safelyRespond(
        interaction,
        'Failed to award achievement or user already has this achievement.'
      );
    }
  } catch (error) {
    logger.error(
      '[ManageAchievementCommand] Error awarding achievement',
      error
    );
    await safelyRespond(
      interaction,
      'An error occurred while awarding the achievement.'
    );
  }
}

/**
 * Handle removing an achievement from a user
 */
async function handleUnawardAchievement(
  interaction: ChatInputCommandInteraction
) {
  const { guild } = interaction;

  if (!guild) {
    await safelyRespond(
      interaction,
      'This command can only be used in a server.'
    );
    return;
  }

  const user = interaction.options.getUser('user', true);
  const achievementId = interaction.options.getInteger('achievement_id', true);

  try {
    const allAchievements = await getAllAchievements();
    const achievement = allAchievements.find((a) => a.id === achievementId);

    if (!achievement) {
      await safelyRespond(
        interaction,
        `Achievement with ID ${achievementId} not found.`
      );
      return;
    }

    const userAchievements = await getUserAchievements(user.id);
    const earnedAchievement = userAchievements.find(
      (ua) => ua.achievementId === achievementId && ua.earnedAt !== null
    );

    if (!earnedAchievement) {
      await safelyRespond(
        interaction,
        `${user.username} has not earned the achievement "${achievement.name}".`
      );
      return;
    }

    const success = await removeUserAchievement(user.id, achievementId);

    if (success) {
      await safelyRespond(
        interaction,
        `Achievement "${achievement.name}" has been removed from ${user.username}.`
      );

      if (achievement.rewardType === 'role' && achievement.rewardValue) {
        try {
          const member = await guild.members.fetch(user.id);
          await member.roles.remove(achievement.rewardValue);
        } catch (error) {
          logger.error(
            '[ManageAchievementCommand] Failed to remove role reward while removing achievement',
            error
          );
          await interaction.followUp({
            content:
              'Note: Failed to remove the role reward. Please check permissions and remove it manually if needed.',
            flags: ['Ephemeral'],
          });
        }
      }
    } else {
      await safelyRespond(
        interaction,
        `Failed to remove achievement "${achievement.name}" from ${user.username}.`
      );
    }
  } catch (error) {
    logger.error(
      '[ManageAchievementCommand] Error removing achievement from user',
      error
    );
    await safelyRespond(
      interaction,
      'An error occurred while removing the achievement.'
    );
  }
}

export default command;
