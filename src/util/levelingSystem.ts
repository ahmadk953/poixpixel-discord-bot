import path from 'path';
import { GuildMember, Message, AttachmentBuilder, Guild } from 'discord.js';
import Canvas, { GlobalFonts } from '@napi-rs/canvas';

import { addXpToUser, db, getUserLevel, getUserRank } from '../db/db.js';
import * as schema from '../db/schema.js';
import { loadConfig } from './configLoader.js';

const config = loadConfig();

const XP_COOLDOWN = 60 * 1000;
const MIN_XP = 15;
const MAX_XP = 25;

const __dirname = path.resolve();

export const calculateXpForLevel = (level: number): number => {
  if (level === 0) return 0;
  return (5 / 6) * level * (2 * level * level + 27 * level + 91);
};

export const calculateLevelFromXp = (xp: number): number => {
  if (xp < calculateXpForLevel(1)) return 0;

  let level = 0;
  while (calculateXpForLevel(level + 1) <= xp) {
    level++;
  }

  return level;
};

export const getXpToNextLevel = (level: number, currentXp: number): number => {
  if (level === 0) return calculateXpForLevel(1) - currentXp;

  const nextLevelXp = calculateXpForLevel(level + 1);
  return nextLevelXp - currentXp;
};

export async function recalculateUserLevels() {
  const users = await db.select().from(schema.levelTable);

  for (const user of users) {
    await addXpToUser(user.discordId, 0);
  }
}

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

function roundRect(
  ctx: Canvas.SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: boolean,
) {
  if (typeof radius === 'undefined') {
    radius = 5;
  }

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fill) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

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
  roundRect(context, 22, 22, 890, 238, 20, true);

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
  roundRect(context, barX, barY, barWidth, barHeight, barHeight / 2, true);

  if (progress > 0) {
    context.fillStyle = '#5865F2';
    roundRect(
      context,
      barX,
      barY,
      barWidth * progress,
      barHeight,
      barHeight / 2,
      true,
    );
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
