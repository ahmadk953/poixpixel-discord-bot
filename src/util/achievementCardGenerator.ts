import Canvas, { GlobalFonts } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';
import path from 'path';

import type * as schema from '@/db/schema.js';
import { drawMultilineText, roundRect } from './helpers.js';
import { logger } from './logger.js';

const __dirname = path.resolve();

/**
 * Generates an achievement card for a user
 * @param achievement - The achievement to generate a card for
 * @returns - The generated card as an AttachmentBuilder
 */
export async function generateAchievementCard(
  achievement: schema.achievementDefinitionsTableTypes,
): Promise<AttachmentBuilder> {
  GlobalFonts.registerFromPath(
    path.join(__dirname, 'assets', 'fonts', 'Manrope-Bold.ttf'),
    'Manrope Bold',
  );
  GlobalFonts.registerFromPath(
    path.join(__dirname, 'assets', 'fonts', 'Manrope-Regular.ttf'),
    'Manrope',
  );

  const width = 600;
  const height = 180;
  const canvas = Canvas.createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#5865F2');
  gradient.addColorStop(1, '#EB459E');
  ctx.fillStyle = gradient;
  roundRect({ ctx, x: 0, y: 0, width, height, radius: 16, fill: true });

  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFFFFF';
  roundRect({
    ctx,
    x: 2,
    y: 2,
    width: width - 4,
    height: height - 4,
    radius: 16,
    fill: false,
  });

  const padding = 40;
  const iconSize = 72;
  const iconX = padding;
  const iconY = height / 2 - iconSize / 2;

  try {
    const iconImage = await Canvas.loadImage(
      achievement.imageUrl ?? path.join(__dirname, 'assets', 'images', 'trophy.png'),
    );

    ctx.save();
    ctx.beginPath();
    ctx.arc(
      iconX + iconSize / 2,
      iconY + iconSize / 2,
      iconSize / 2,
      0,
      Math.PI * 2,
    );
    ctx.clip();
    ctx.drawImage(iconImage, iconX, iconY, iconSize, iconSize);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(
      iconX + iconSize / 2,
      iconY + iconSize / 2,
      iconSize / 2 + 4,
      0,
      Math.PI * 2,
    );
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  } catch (error) {
    logger.error(
      '[AchievementCardGenerator] Failed to load achievement icon',
      error,
    );
  }

  const textX = iconX + iconSize + 24;
  const titleY = 60;
  const nameY = titleY + 35;
  const descY = nameY + 34;

  ctx.fillStyle = '#FFFFFF';

  ctx.font = '22px "Manrope Bold"';
  ctx.fillText('Achievement Unlocked!', textX, titleY);

  ctx.font = '32px "Manrope Bold"';
  ctx.fillText(achievement.name, textX, nameY);

  ctx.font = '20px "Manrope"';
  drawMultilineText(
    ctx,
    achievement.description,
    textX,
    descY,
    width - textX - 32,
    24,
  );

  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'achievement.png' });
}
