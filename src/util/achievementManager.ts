import { Message, EmbedBuilder, TextChannel, Guild } from 'discord.js';

import {
  addXpToUser,
  getAllAchievements,
  getUserAchievements,
  getUserLevel,
  getUserReactionCount,
  updateAchievementProgress,
} from '@/db/db.js';
import * as schema from '@/db/schema.js';
import { loadConfig } from './configLoader.js';
import { generateAchievementCard } from './achievementCardGenerator.js';
import { logger } from './logger.js';

/**
 * Handle achievement progress updates
 * @param userId - ID of the user
 * @param guild - Guild instance (can be null if not applicable)
 * @param achievement - Achievement definition
 * @param progress - Progress percentage (0-100)
 * @param options - Additional options
 */
async function handleProgress(
  userId: string,
  guild: Guild | null,
  achievement: schema.achievementDefinitionsTableTypes,
  progress: number,
  options: { skipAward?: boolean } = {},
): Promise<void> {
  const { skipAward = false } = options;
  const userAchievements = await getUserAchievements(userId);
  const existing = userAchievements.find(
    (a) => a.achievementId === achievement.id && a.earnedAt !== null,
  );

  const updated = await updateAchievementProgress(
    userId,
    achievement.id,
    progress,
  );

  if (progress === 100 && !existing && !skipAward) {
    if (updated && guild) {
      await announceAchievement(guild, userId, achievement);
    }
  }
}

/**
 * Process message achievements based on user activity
 * @param message - The message object from Discord
 */
export async function processMessageAchievements(
  message: Message,
): Promise<void> {
  if (message.author.bot) return;
  const userData = await getUserLevel(message.author.id);
  const allAchievements = await getAllAchievements();

  for (const ach of allAchievements.filter(
    (a) => a.requirementType === 'message_count',
  )) {
    const progress = Math.min(
      100,
      (userData.messagesSent / ach.threshold) * 100,
    );
    await handleProgress(message.author.id, message.guild!, ach, progress);
  }
}

/**
 * Process level-up achievements when a user levels up
 * @param memberId - ID of the member who leveled up
 * @param newLevel - The new level the member has reached
 * @param guild - Guild instance where the member belongs
 */
export async function processLevelUpAchievements(
  memberId: string,
  newLevel: number,
  guild: Guild,
): Promise<void> {
  const allAchievements = await getAllAchievements();
  for (const ach of allAchievements.filter(
    (a) => a.requirementType === 'level',
  )) {
    const progress = Math.min(100, (newLevel / ach.threshold) * 100);
    await handleProgress(memberId, guild, ach, progress);
  }
}

/**
 * Process command usage achievements when a command is invoked
 * @param userId - ID of the user who invoked the command
 * @param commandName - Name of the command invoked
 * @param guild - Guild instance where the command was invoked
 */
export async function processCommandAchievements(
  userId: string,
  commandName: string,
  guild: Guild,
): Promise<void> {
  const allAchievements = await getAllAchievements();
  const commandAchievements = allAchievements.filter(
    (a) =>
      a.requirementType === 'command_usage' &&
      a.requirement &&
      (a.requirement as any).command === commandName,
  );

  // fetch the user’s current achievement entries
  const userAchievements = await getUserAchievements(userId);

  for (const ach of commandAchievements) {
    // find existing progress, default to 0
    const userAch = userAchievements.find((u) => u.achievementId === ach.id);
    const oldProgress = userAch?.progress ?? 0;

    // compute how many times they've run this command so far
    const timesRanSoFar = (oldProgress / 100) * ach.threshold;
    const newCount = timesRanSoFar + 1;

    // convert back into a percentage
    const newProgress = Math.min(100, (newCount / ach.threshold) * 100);

    // Delegate to handleProgress which will update or award
    await handleProgress(userId, guild, ach, newProgress);
  }
}

/**
 * Process reaction achievements when a user reacts to a message
 * @param userId - ID of the user who reacted
 * @param guild - Guild instance where the reaction occurred
 * @param isRemoval - Whether the reaction was removed (default: false)
 */
export async function processReactionAchievements(
  userId: string,
  guild: Guild,
  isRemoval: boolean = false,
): Promise<void> {
  try {
    const member = await guild.members.fetch(userId);
    if (member.user.bot) return;

    const allAchievements = await getAllAchievements();
    const reactionAchievements = allAchievements.filter(
      (a) => a.requirementType === 'reactions',
    );
    if (!reactionAchievements.length) return;

    const reactionCount = await getUserReactionCount(userId);

    for (const ach of reactionAchievements) {
      const progress = Math.max(
        0,
        Math.min(100, (reactionCount / ach.threshold) * 100),
      );
      await handleProgress(userId, guild, ach, progress, {
        skipAward: isRemoval,
      });
    }
  } catch (error) {
    logger.error('Error processing reaction achievements', error);
  }
}

/**
 * Announce a newly earned achievement
 * @param guild - Guild instance
 * @param userId - ID of the user who earned the achievement
 * @param achievement - Achievement definition
 */
export async function announceAchievement(
  guild: Guild,
  userId: string,
  achievement: schema.achievementDefinitionsTableTypes,
): Promise<void> {
  try {
    const config = loadConfig();

    const member = await guild.members.fetch(userId);
    if (!member) {
      logger.warn(`[AchievementManager] Member ${userId} not found in guild`);
      return;
    }

    const achievementCard = await generateAchievementCard(achievement);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setDescription(
        `**${member.user.username}** just unlocked the achievement: **${achievement.name}**! 🎉`,
      )
      .setImage('attachment://achievement.png')
      .setTimestamp();

    const advChannel = guild.channels.cache.get(config.channels.advancements);
    if (advChannel?.isTextBased()) {
      await (advChannel as TextChannel).send({
        content: `Congratulations <@${userId}>!`,
        embeds: [embed],
        files: [achievementCard],
      });
    }

    if (achievement.rewardType === 'xp' && achievement.rewardValue) {
      const xpAmount = parseInt(achievement.rewardValue);
      if (!isNaN(xpAmount)) {
        await addXpToUser(userId, xpAmount);
      }
    } else if (achievement.rewardType === 'role' && achievement.rewardValue) {
      try {
        await member.roles.add(achievement.rewardValue);
      } catch (error) {
        logger.error(
          `[AchievementManager] Failed to add role ${achievement.rewardValue} to user ${userId}`,
          error,
        );
      }
    }
  } catch (error) {
    logger.error('[AchievementManager] Error announcing achievement', error);
  }
}
