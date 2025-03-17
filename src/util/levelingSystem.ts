import path from 'path';
import Canvas, { GlobalFonts } from '@napi-rs/canvas';
import { GuildMember, Message, AttachmentBuilder, Guild } from 'discord.js';

import {
  addXpToUser,
  db,
  getUserLevel,
  getUserRank,
  handleDbError,
} from '../db/db.js';
import * as schema from '../db/schema.js';
import { loadConfig } from './configLoader.js';
import { roundRect } from './helpers.js';

const config = loadConfig();

const XP_COOLDOWN = config.leveling.xpCooldown * 1000;
const MIN_XP = config.leveling.minXpAwarded;
const MAX_XP = config.leveling.maxXpAwarded;

const __dirname = path.resolve();

/**
 * Calculates the amount of XP required to reach the given level
 * @param level - The level to calculate the XP for
 * @returns - The amount of XP required to reach the given level
 */
export const calculateXpForLevel = (level: number): number => {
  if (level === 0) return 0;
  return (5 / 6) * level * (2 * level * level + 27 * level + 91);
};

/**
 * Calculates the level that corresponds to the given amount of XP
 * @param xp - The amount of XP to calculate the level for
 * @returns - The level that corresponds to the given amount of XP
 */
export const calculateLevelFromXp = (xp: number): number => {
  if (xp < calculateXpForLevel(1)) return 0;

  let level = 0;
  while (calculateXpForLevel(level + 1) <= xp) {
    level++;
  }

  return level;
};

/**
 * Gets the amount of XP required to reach the next level
 * @param level - The level to calculate the XP for
 * @param currentXp - The current amount of XP
 * @returns - The amount of XP required to reach the next level
 */
export const getXpToNextLevel = (level: number, currentXp: number): number => {
  if (level === 0) return calculateXpForLevel(1) - currentXp;

  const nextLevelXp = calculateXpForLevel(level + 1);
  return nextLevelXp - currentXp;
};

/**
 * Recalculates the levels for all users in the database
 */
export async function recalculateUserLevels() {
  try {
    const users = await db.select().from(schema.levelTable);

    for (const user of users) {
      await addXpToUser(user.discordId, 0);
    }
  } catch (error) {
    handleDbError('Failed to recalculate user levels', error as Error);
  }
}

/**
 * Processes a message for XP
 * @param message - The message to process for XP
 * @returns - The result of processing the message
 */
export async function processMessage(message: Message) {
  if (message.author.bot || !message.guild) return;

  try {
    const userId = message.author.id;
    const userData = await getUserLevel(userId);

    if (userData.lastMessageTimestamp) {
      const lastMessageTime = new Date(userData.lastMessageTimestamp).getTime();
      const currentTime = Date.now();

      if (currentTime - lastMessageTime < XP_COOLDOWN) {
        return null;
      }
    }

    const xpToAdd = Math.floor(Math.random() * (MAX_XP - MIN_XP + 1)) + MIN_XP;
    const result = await addXpToUser(userId, xpToAdd);

    return result;
  } catch (error) {
    console.error('Error processing message for XP:', error);
    return null;
  }
}

/**
 * Generates a rank card for the given member
 * @param member - The member to generate a rank card for
 * @param userData - The user's level data
 * @returns - The rank card as an attachment
 */
export async function generateRankCard(
  member: GuildMember,
  userData: schema.levelTableTypes,
) {
  GlobalFonts.registerFromPath(
    path.join(__dirname, 'assets', 'fonts', 'Manrope-Bold.ttf'),
    'Manrope Bold',
  );
  GlobalFonts.registerFromPath(
    path.join(__dirname, 'assets', 'fonts', 'Manrope-Regular.ttf'),
    'Manrope',
  );

  const userRank = await getUserRank(userData.discordId);

  const canvas = Canvas.createCanvas(934, 282);
  const context = canvas.getContext('2d');

  context.fillStyle = '#23272A';
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = '#2C2F33';
  roundRect({
    ctx: context,
    x: 22,
    y: 22,
    width: 890,
    height: 238,
    radius: 20,
    fill: true,
  });

  try {
    const avatar = await Canvas.loadImage(
      member.user.displayAvatarURL({ extension: 'png', size: 256 }),
    );
    context.save();
    context.beginPath();
    context.arc(120, 141, 80, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    context.drawImage(avatar, 40, 61, 160, 160);
    context.restore();
  } catch (error) {
    console.error('Error loading avatar image:', error);
    context.fillStyle = '#5865F2';
    context.beginPath();
    context.arc(120, 141, 80, 0, Math.PI * 2);
    context.fill();
  }

  context.font = '38px "Manrope Bold"';
  context.fillStyle = '#FFFFFF';
  context.fillText(member.user.username, 242, 142);

  context.font = '24px "Manrope Bold"';
  context.fillStyle = '#FFFFFF';
  context.textAlign = 'end';
  context.fillText(`LEVEL ${userData.level}`, 890, 82);

  context.font = '24px "Manrope Bold"';
  context.fillStyle = '#FFFFFF';
  context.fillText(`RANK #${userRank}`, 890, 122);

  const barWidth = 615;
  const barHeight = 38;
  const barX = 242;
  const barY = 182;

  const currentLevel = userData.level;
  const currentLevelXp = calculateXpForLevel(currentLevel);
  const nextLevelXp = calculateXpForLevel(currentLevel + 1);

  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;

  let xpIntoCurrentLevel;
  if (currentLevel === 0) {
    xpIntoCurrentLevel = userData.xp;
  } else {
    xpIntoCurrentLevel = userData.xp - currentLevelXp;
  }

  const progress = Math.max(
    0,
    Math.min(xpIntoCurrentLevel / xpNeededForNextLevel, 1),
  );

  context.fillStyle = '#484b4E';
  roundRect({
    ctx: context,
    x: barX,
    y: barY,
    width: barWidth,
    height: barHeight,
    radius: barHeight / 2,
    fill: true,
  });

  if (progress > 0) {
    context.fillStyle = '#5865F2';
    roundRect({
      ctx: context,
      x: barX,
      y: barY,
      width: barWidth * progress,
      height: barHeight,
      radius: barHeight / 2,
      fill: true,
    });
  }

  context.textAlign = 'center';
  context.font = '20px "Manrope"';
  context.fillStyle = '#A0A0A0';
  context.fillText(
    `${xpIntoCurrentLevel.toLocaleString()} / ${xpNeededForNextLevel.toLocaleString()} XP`,
    barX + barWidth / 2,
    barY + barHeight / 2 + 7,
  );

  return new AttachmentBuilder(canvas.toBuffer('image/png'), {
    name: 'rank-card.png',
  });
}

/**
 * Assigns level roles to a user based on their new level
 * @param guild - The guild to assign roles in
 * @param userId - The userId of the user to assign roles to
 * @param newLevel - The new level of the user
 * @returns - The highest role that was assigned
 */
export async function checkAndAssignLevelRoles(
  guild: Guild,
  userId: string,
  newLevel: number,
) {
  try {
    if (!config.roles.levelRoles || config.roles.levelRoles.length === 0) {
      return;
    }

    const member = await guild.members.fetch(userId);
    if (!member) return;

    const rolesToAdd = config.roles.levelRoles
      .filter((role) => role.level <= newLevel)
      .map((role) => role.roleId);

    if (rolesToAdd.length === 0) return;

    const existingLevelRoles = config.roles.levelRoles.map((r) => r.roleId);
    const rolesToRemove = member.roles.cache.filter((role) =>
      existingLevelRoles.includes(role.id),
    );
    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove);
    }

    const highestRole = rolesToAdd[rolesToAdd.length - 1];
    await member.roles.add(highestRole);

    return highestRole;
  } catch (error) {
    console.error('Error assigning level roles:', error);
  }
}
