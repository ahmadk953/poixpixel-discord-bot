import {
  Message,
  Client,
  EmbedBuilder,
  GuildMember,
  TextChannel,
  Guild,
} from 'discord.js';

import {
  addXpToUser,
  awardAchievement,
  getAllAchievements,
  getUserAchievements,
  getUserLevel,
  getUserReactionCount,
  updateAchievementProgress,
} from '@/db/db.js';
import * as schema from '@/db/schema.js';
import { loadConfig } from './configLoader.js';
import { generateAchievementCard } from './achievementCardGenerator.js';

/**
 * Check and process achievements for a user based on a message
 * @param message - The message that triggered the check
 */
export async function processMessageAchievements(
  message: Message,
): Promise<void> {
  if (message.author.bot) return;

  const userData = await getUserLevel(message.author.id);
  const allAchievements = await getAllAchievements();

  const messageAchievements = allAchievements.filter(
    (a) => a.requirementType === 'message_count',
  );

  for (const achievement of messageAchievements) {
    const progress = Math.min(
      100,
      (userData.messagesSent / achievement.threshold) * 100,
    );

    if (progress >= 100) {
      const userAchievements = await getUserAchievements(message.author.id);
      const existingAchievement = userAchievements.find(
        (a) => a.achievementId === achievement.id && a.earnedAt !== null,
      );

      if (!existingAchievement) {
        const awarded = await awardAchievement(
          message.author.id,
          achievement.id,
        );
        if (awarded) {
          await announceAchievement(
            message.guild!,
            message.author.id,
            achievement,
          );
        }
      }
    } else {
      await updateAchievementProgress(
        message.author.id,
        achievement.id,
        progress,
      );
    }
  }

  const levelAchievements = allAchievements.filter(
    (a) => a.requirementType === 'level',
  );

  for (const achievement of levelAchievements) {
    const progress = Math.min(
      100,
      (userData.level / achievement.threshold) * 100,
    );

    if (progress >= 100) {
      const userAchievements = await getUserAchievements(message.author.id);
      const existingAchievement = userAchievements.find(
        (a) => a.achievementId === achievement.id && a.earnedAt !== null,
      );

      if (!existingAchievement) {
        const awarded = await awardAchievement(
          message.author.id,
          achievement.id,
        );
        if (awarded) {
          await announceAchievement(
            message.guild!,
            message.author.id,
            achievement,
          );
        }
      }
    } else {
      await updateAchievementProgress(
        message.author.id,
        achievement.id,
        progress,
      );
    }
  }
}

/**
 * Check achievements for level-ups
 * @param memberId - Member ID who leveled up
 * @param newLevel - New level value
 * @guild - Guild instance
 */
export async function processLevelUpAchievements(
  memberId: string,
  newLevel: number,
  guild: Guild,
): Promise<void> {
  const allAchievements = await getAllAchievements();

  const levelAchievements = allAchievements.filter(
    (a) => a.requirementType === 'level',
  );

  for (const achievement of levelAchievements) {
    const progress = Math.min(100, (newLevel / achievement.threshold) * 100);

    if (progress >= 100) {
      const userAchievements = await getUserAchievements(memberId);
      const existingAchievement = userAchievements.find(
        (a) => a.achievementId === achievement.id && a.earnedAt !== null,
      );

      if (!existingAchievement) {
        const awarded = await awardAchievement(memberId, achievement.id);
        if (awarded) {
          await announceAchievement(guild, memberId, achievement);
        }
      }
    } else {
      await updateAchievementProgress(memberId, achievement.id, progress);
    }
  }
}

/**
 * Process achievements for command usage
 * @param userId - User ID who used the command
 * @param commandName - Name of the command
 * @param client - Guild instance
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

  for (const achievement of commandAchievements) {
    const userAchievements = await getUserAchievements(userId);
    const existingAchievement = userAchievements.find(
      (a) => a.achievementId === achievement.id && a.earnedAt !== null,
    );

    if (!existingAchievement) {
      const awarded = await awardAchievement(userId, achievement.id);
      if (awarded) {
        await announceAchievement(guild, userId, achievement);
      }
    }
  }
}

/**
 * Process achievements for reaction events (add or remove)
 * @param userId - User ID who added/removed the reaction
 * @param guild - Guild instance
 * @param isRemoval - Whether this is a reaction removal (true) or addition (false)
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

    if (reactionAchievements.length === 0) return;

    const reactionCount = await getUserReactionCount(userId);

    for (const achievement of reactionAchievements) {
      const progress = Math.max(
        0,
        Math.min(100, (reactionCount / achievement.threshold) * 100),
      );

      if (progress >= 100 && !isRemoval) {
        const userAchievements = await getUserAchievements(userId);
        const existingAchievement = userAchievements.find(
          (a) =>
            a.achievementId === achievement.id &&
            a.earnedAt !== null &&
            a.earnedAt !== undefined &&
            new Date(a.earnedAt).getTime() > 0,
        );

        if (!existingAchievement) {
          const awarded = await awardAchievement(userId, achievement.id);
          if (awarded) {
            await announceAchievement(guild, userId, achievement);
          }
        }
      }

      await updateAchievementProgress(userId, achievement.id, progress);
    }
  } catch (error) {
    console.error('Error processing reaction achievements:', error);
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

    if (!guild) {
      console.error(`Guild ${guild} not found`);
      return;
    }

    const member = await guild.members.fetch(userId);
    if (!member) {
      console.warn(`Member ${userId} not found in guild`);
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
      } catch (err) {
        console.error(
          `Failed to add role ${achievement.rewardValue} to user ${userId}`,
          err,
        );
      }
    }
  } catch (error) {
    console.error('Error announcing achievement:', error);
  }
}
