import path from 'node:path';

import Canvas, { GlobalFonts } from '@napi-rs/canvas';
import { AttachmentBuilder, type GuildMember } from 'discord.js';

import { getUserRank } from '@/db/db.js';
import type { levelTableTypes } from '@/db/schema.js';
import { roundRect } from '../helpers.js';
import { logger } from '../logger.js';
import { calculateXpForLevel } from './xpCalculations.js';

const assetsRoot = path.resolve();

/**
 * Generates a rank card for the given member
 * @param member - The member to generate a rank card for
 * @param userData - The user's level data
 * @returns - The rank card as an attachment
 */
export async function generateRankCard(
  member: GuildMember,
  userData: levelTableTypes
) {
  GlobalFonts.registerFromPath(
    path.join(assetsRoot, 'assets', 'fonts', 'Manrope-Bold.ttf'),
    'Manrope Bold'
  );
  GlobalFonts.registerFromPath(
    path.join(assetsRoot, 'assets', 'fonts', 'Manrope-Regular.ttf'),
    'Manrope'
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
      member.user.displayAvatarURL({ extension: 'png', size: 256 })
    );
    context.save();
    context.beginPath();
    context.arc(120, 141, 80, 0, Math.PI * 2);
    context.closePath();
    context.clip();
    context.drawImage(avatar, 40, 61, 160, 160);
    context.restore();
  } catch (error) {
    logger.error('[LevelingManager] Error loading avatar image', error);
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

  let xpIntoCurrentLevel: number;
  if (currentLevel === 0) {
    xpIntoCurrentLevel = userData.xp;
  } else {
    xpIntoCurrentLevel = userData.xp - currentLevelXp;
  }

  const progress = Math.max(
    0,
    Math.min(xpIntoCurrentLevel / xpNeededForNextLevel, 1)
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
    barY + barHeight / 2 + 7
  );

  return new AttachmentBuilder(canvas.toBuffer('image/png'), {
    name: 'rank-card.png',
  });
}
