import Canvas from '@napi-rs/canvas';
import path from 'path';

import { AttachmentBuilder, Client, GuildMember, Guild } from 'discord.js';
import { and, eq } from 'drizzle-orm';

import { moderationTable } from '../db/schema.js';
import { db, updateMember } from '../db/db.js';
import logAction from './logging/logAction.js';

const __dirname = path.resolve();

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

interface generateMemberBannerTypes {
  member: GuildMember;
  width: number;
  height: number;
}

export async function generateMemberBanner({
  member,
  width,
  height,
}: generateMemberBannerTypes) {
  const welcomeBackground = path.join(__dirname, 'assets', 'welcome-bg.png');
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

export async function scheduleUnban(
  client: Client,
  guildId: string,
  userId: string,
  expiresAt: Date,
) {
  const timeUntilUnban = expiresAt.getTime() - Date.now();
  if (timeUntilUnban > 0) {
    setTimeout(async () => {
      await executeUnban(client, guildId, userId);
    }, timeUntilUnban);
  }
}

export async function executeUnban(
  client: Client,
  guildId: string,
  userId: string,
  reason?: string,
) {
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
      moderator: guild.members.cache.get(client.user!.id)!,
      reason: reason ?? 'Temporary ban expired',
    });
  } catch (error) {
    console.error(`Failed to unban user ${userId}:`, error);
  }
}

export async function loadActiveBans(client: Client, guild: Guild) {
  const activeBans = await db
    .select()
    .from(moderationTable)
    .where(
      and(eq(moderationTable.action, 'ban'), eq(moderationTable.active, true)),
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
}
