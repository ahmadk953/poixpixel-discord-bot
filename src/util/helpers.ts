import Canvas from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

import {
  AttachmentBuilder,
  Client,
  GuildMember,
  Guild,
  Interaction,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  DiscordAPIError,
} from 'discord.js';
import { and, eq } from 'drizzle-orm';

import { moderationTable } from '@/db/schema.js';
import { db, getMember, handleDbError, updateMember } from '@/db/db.js';
import logAction from './logging/logAction.js';

const PROJECT_ROOT = path.resolve();

/**
 * Turns a duration string into milliseconds
 * @param duration - The duration to parse
 * @returns - The parsed duration in milliseconds
 */
export function parseDuration(duration: string): number {
  const regex = /^(\d+)(s|m|h|d)$/;
  const match = duration.match(regex);
  if (!match) throw new Error('Invalid duration format');
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error('Invalid duration unit');
  }
}

/**
 * Member banner types
 */
interface generateMemberBannerTypes {
  member: GuildMember;
  width: number;
  height: number;
}

/**
 * Generates a welcome banner for a member
 * @param member - The member to generate a banner for
 * @param width - The width of the banner
 * @param height - The height of the banner
 * @returns - The generated banner
 */
export async function generateMemberBanner({
  member,
  width,
  height,
}: generateMemberBannerTypes): Promise<AttachmentBuilder> {
  const welcomeBackground = path.join(
    PROJECT_ROOT,
    'assets',
    'images',
    'welcome-bg.png',
  );
  const canvas = Canvas.createCanvas(width, height);
  const context = canvas.getContext('2d');
  const background = await Canvas.loadImage(welcomeBackground);
  const memberCount = member.guild.memberCount;
  const avatarSize = 150;
  const avatarY = height - avatarSize - 25;
  const avatarX = width / 2 - avatarSize / 2;

  context.drawImage(background, 0, 0, width, height);

  context.fillStyle = 'rgba(0, 0, 0, 0.5)';
  context.fillRect(0, 0, width, height);

  context.font = '60px Sans';
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.fillText('Welcome', width / 2, height / 3.25);

  context.font = '40px Sans';
  context.fillText(member.user.username, width / 2, height / 2.25);

  context.font = '30px Sans';
  context.fillText(`You are member #${memberCount}`, width / 2, height / 1.75);

  context.beginPath();
  context.arc(
    width / 2,
    height - avatarSize / 2 - 25,
    avatarSize / 2,
    0,
    Math.PI * 2,
    true,
  );
  context.closePath();
  context.clip();

  const avatarURL = member.user.displayAvatarURL({
    extension: 'png',
    size: 256,
  });
  const avatar = await Canvas.loadImage(avatarURL);
  context.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);

  const attachment = new AttachmentBuilder(await canvas.encode('png'), {
    name: 'welcome-image.png',
  });

  return attachment;
}

/**
 * Executes an unmute for a user
 * @param client - The client to use
 * @param guildId - The guild ID to unmute the user in
 * @param userId - The user ID to unmute
 * @param reason - The reason for the unmute
 * @param moderator - The moderator who is unmuting the user
 * @param alreadyUnmuted - Whether the user is already unmuted
 */
export async function executeUnmute(
  client: Client,
  guildId: string,
  userId: string,
  reason?: string,
  moderator?: GuildMember,
  alreadyUnmuted: boolean = false,
): Promise<void> {
  try {
    const guild = await client.guilds.fetch(guildId);
    let member;

    try {
      member = await guild.members.fetch(userId);
      if (!alreadyUnmuted) {
        await member.timeout(null, reason ?? 'Temporary mute expired');
      }
    } catch (error) {
      console.log(
        `Member ${userId} not found in server, just updating database`,
      );
    }

    if (!(await getMember(userId))?.currentlyMuted) return;

    await db
      .update(moderationTable)
      .set({ active: false })
      .where(
        and(
          eq(moderationTable.discordId, userId),
          eq(moderationTable.action, 'mute'),
          eq(moderationTable.active, true),
        ),
      );

    await updateMember({
      discordId: userId,
      currentlyMuted: false,
    });

    if (member) {
      await logAction({
        guild,
        action: 'unmute',
        target: member,
        reason: reason ?? 'Temporary mute expired',
        moderator: moderator ? moderator : guild.members.me!,
      });
    }
  } catch (error) {
    console.error('Error executing unmute:', error);

    if (!(error instanceof DiscordAPIError && error.code === 10007)) {
      handleDbError('Failed to execute unmute', error as Error);
    }
  }
}

/**
 * Loads all active mutes and schedules unmute events
 * @param client - The client to use
 * @param guild - The guild to load mutes for
 */
export async function loadActiveMutes(
  client: Client,
  guild: Guild,
): Promise<void> {
  try {
    const activeMutes = await db
      .select()
      .from(moderationTable)
      .where(
        and(
          eq(moderationTable.action, 'mute'),
          eq(moderationTable.active, true),
        ),
      );

    for (const mute of activeMutes) {
      if (!mute.expiresAt) continue;

      const timeUntilUnmute = mute.expiresAt.getTime() - Date.now();
      if (timeUntilUnmute <= 0) {
        await executeUnmute(client, guild.id, mute.discordId);
      }
    }
  } catch (error) {
    handleDbError('Failed to load active mutes', error as Error);
  }
}

/**
 * Schedules an unban for a user
 * @param client - The client to use
 * @param guildId - The guild ID to unban the user from
 * @param userId - The user ID to unban
 * @param expiresAt - The date to unban the user at
 */
export async function scheduleUnban(
  client: Client,
  guildId: string,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  const timeUntilUnban = expiresAt.getTime() - Date.now();
  if (timeUntilUnban > 0) {
    setTimeout(async () => {
      await executeUnban(client, guildId, userId);
    }, timeUntilUnban);
  }
}

/**
 * Executes an unban for a user
 * @param client - The client to use
 * @param guildId - The guild ID to unban the user from
 * @param userId - The user ID to unban
 * @param reason - The reason for the unban
 */
export async function executeUnban(
  client: Client,
  guildId: string,
  userId: string,
  reason?: string,
): Promise<void> {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.members.unban(userId, reason ?? 'Temporary ban expired');

    await db
      .update(moderationTable)
      .set({ active: false })
      .where(
        and(
          eq(moderationTable.discordId, userId),
          eq(moderationTable.action, 'ban'),
          eq(moderationTable.active, true),
        ),
      );

    await updateMember({
      discordId: userId,
      currentlyBanned: false,
    });

    await logAction({
      guild,
      action: 'unban',
      target: guild.members.cache.get(userId)!,
      moderator: guild.members.me!,
      reason: reason ?? 'Temporary ban expired',
    });
  } catch (error) {
    handleDbError(`Failed to unban user ${userId}`, error as Error);
  }
}

/**
 * Loads all active bans and schedules unban events
 * @param client - The client to use
 * @param guild - The guild to load bans for
 */
export async function loadActiveBans(
  client: Client,
  guild: Guild,
): Promise<void> {
  try {
    const activeBans = await db
      .select()
      .from(moderationTable)
      .where(
        and(
          eq(moderationTable.action, 'ban'),
          eq(moderationTable.active, true),
        ),
      );

    for (const ban of activeBans) {
      if (!ban.expiresAt) continue;

      const timeUntilUnban = ban.expiresAt.getTime() - Date.now();
      if (timeUntilUnban <= 0) {
        await executeUnban(client, guild.id, ban.discordId);
      } else {
        await scheduleUnban(client, guild.id, ban.discordId, ban.expiresAt);
      }
    }
  } catch (error) {
    handleDbError('Failed to load active bans', error as Error);
  }
}

/**
 * Types for the roundRect function
 */
interface roundRectTypes {
  ctx: Canvas.SKRSContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: boolean;
  radius?: number;
}

/**
 * Creates a rounded rectangle
 * @param ctx - The canvas context to use
 * @param x - The x position of the rectangle
 * @param y - The y position of the rectangle
 * @param width - The width of the rectangle
 * @param height - The height of the rectangle
 * @param radius - The radius of the corners
 * @param fill - Whether to fill the rectangle
 */
export function roundRect({
  ctx,
  x,
  y,
  width,
  height,
  radius,
  fill,
}: roundRectTypes): void {
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

/**
 * Draw wrapped text in multiple lines
 * @param ctx - The canvas context to use
 * @param text - The text to draw
 * @param x - The x position to draw the text
 * @param y - The y position to draw the text
 * @param maxWidth - The maximum width of the text
 * @param lineHeight - The height of each line
 */
export function drawMultilineText(
  ctx: Canvas.SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line, x, y);
      line = words[i] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

/**
 * Checks if an interaction is valid
 * @param interaction - The interaction to check
 * @returns - Whether the interaction is valid
 */
export async function validateInteraction(
  interaction: Interaction,
): Promise<boolean> {
  if (!interaction.inGuild()) return false;
  if (!interaction.channel) return false;

  if (interaction.isMessageComponent()) {
    try {
      await interaction.channel.messages.fetch(interaction.message.id);
      return true;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Safely responds to an interaction
 * @param interaction - The interaction to respond to
 * @param content - The content to send
 */
export async function safelyRespond(interaction: Interaction, content: string) {
  try {
    if (!interaction.isRepliable()) return;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: ['Ephemeral'] });
    } else {
      await interaction.reply({ content, flags: ['Ephemeral'] });
    }
  } catch (error) {
    console.error('Failed to respond to interaction:', error);
  }
}

/**
 * Creates pagination buttons for navigating through multiple pages
 * @param totalPages - The total number of pages
 * @param currentPage - The current page number
 * @returns - The action row with pagination buttons
 */
export function createPaginationButtons(
  totalPages: number,
  currentPage: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('first')
      .setLabel('⏮️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 0),
    new ButtonBuilder()
      .setCustomId('pageinfo')
      .setLabel(`Page ${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('▶️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages - 1),
    new ButtonBuilder()
      .setCustomId('last')
      .setLabel('⏭️')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages - 1),
  );
}
