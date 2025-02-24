import {
  TextChannel,
  ButtonStyle,
  ButtonBuilder,
  ActionRowBuilder,
  GuildChannel,
} from 'discord.js';
import {
  LogActionPayload,
  ModerationLogAction,
  RoleUpdateAction,
} from './types.js';
import { ACTION_COLORS, CHANNEL_TYPES } from './constants.js';
import {
  createUserField,
  createModeratorField,
  createChannelField,
  createPermissionChangeFields,
  createRoleChangeFields,
  getLogItemId,
  getEmojiForAction,
} from './utils.js';

export default async function logAction(payload: LogActionPayload) {
  const logChannel = payload.guild.channels.cache.get('1007787977432383611');
  if (!logChannel || !(logChannel instanceof TextChannel)) {
    console.error('Log channel not found or is not a Text Channel.');
    return;
  }

  const fields = [];
  const components = [];

  switch (payload.action) {
    case 'ban':
    case 'kick':
    case 'mute':
    case 'unban':
    case 'unmute':
    case 'warn': {
      const moderationPayload = payload as ModerationLogAction;
      fields.push(
        createUserField(moderationPayload.target, 'User'),
        createModeratorField(moderationPayload.moderator, 'Moderator')!,
        { name: 'Reason', value: moderationPayload.reason, inline: false },
      );
      if (moderationPayload.duration) {
        fields.push({
          name: 'Duration',
          value: moderationPayload.duration,
          inline: true,
        });
      }
      break;
    }

    case 'messageDelete': {
      if (!payload.message.guild) return;

      fields.push(
        createUserField(payload.message.author, 'Author'),
        createChannelField(payload.message.channel as GuildChannel),
        {
          name: 'Content',
          value: payload.message.content || '*No content*',
          inline: false,
        },
      );
      break;
    }

    case 'messageEdit': {
      if (!payload.message.guild) return;

      fields.push(
        createUserField(payload.message.author, 'Author'),
        createChannelField(payload.message.channel as GuildChannel),
        {
          name: 'Before',
          value: payload.oldContent || '*No content*',
          inline: false,
        },
        {
          name: 'After',
          value: payload.newContent || '*No content*',
          inline: false,
        },
      );

      components.push(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel('Jump to Message')
            .setStyle(ButtonStyle.Link)
            .setURL(payload.message.url),
        ),
      );
      break;
    }

    case 'memberJoin':
    case 'memberLeave': {
      fields.push(createUserField(payload.member, 'User'), {
        name: 'Account Created',
        value: `<t:${Math.floor(payload.member.user.createdTimestamp / 1000)}:R>`,
        inline: true,
      });
      break;
    }

    case 'memberUsernameUpdate':
    case 'memberNicknameUpdate': {
      const isUsername = payload.action === 'memberUsernameUpdate';

      fields.push(createUserField(payload.member, 'User'), {
        name: '📝 Change Details',
        value: [
          `**Type:** ${isUsername ? 'Username' : 'Nickname'} Update`,
          `**Before:** ${payload.oldValue}`,
          `**After:** ${payload.newValue}`,
        ].join('\n'),
        inline: false,
      });
      break;
    }

    case 'roleAdd':
    case 'roleRemove': {
      fields.push(createUserField(payload.member, 'User'), {
        name: 'Role',
        value: payload.role.name,
        inline: true,
      });
      const moderatorField = createModeratorField(
        payload.moderator,
        'Added/Removed By',
      );
      if (moderatorField) fields.push(moderatorField);
      break;
    }

    case 'roleCreate':
    case 'roleDelete': {
      fields.push(
        { name: 'Role Name', value: payload.role.name, inline: true },
        {
          name: 'Role Color',
          value: payload.role.hexColor || 'No Color',
          inline: true,
        },
        {
          name: 'Hoisted',
          value: payload.role.hoist ? 'Yes' : 'No',
          inline: true,
        },
        {
          name: 'Mentionable',
          value: payload.role.mentionable ? 'Yes' : 'No',
          inline: true,
        },
      );
      const moderatorField = createModeratorField(
        payload.moderator,
        payload.action === 'roleCreate' ? 'Created By' : 'Deleted By',
      );
      if (moderatorField) fields.push(moderatorField);
      break;
    }

    case 'roleUpdate': {
      const rolePayload = payload as RoleUpdateAction;

      fields.push({
        name: '📝 Role Information',
        value: [
          `**Name:** ${rolePayload.role.name}`,
          `**Color:** ${rolePayload.role.hexColor}`,
          `**Position:** ${rolePayload.role.position}`,
        ].join('\n'),
        inline: false,
      });

      const changes = createRoleChangeFields(
        rolePayload.oldRole,
        rolePayload.newRole,
      );
      if (changes.length) {
        fields.push({
          name: '🔄 Changes Made',
          value: changes
            .map((field) => `**${field.name}:** ${field.value}`)
            .join('\n'),
          inline: false,
        });
      }

      const permissionChanges = createPermissionChangeFields(
        rolePayload.oldPermissions,
        rolePayload.newPermissions,
      );
      fields.push(...permissionChanges);

      const moderatorField = createModeratorField(
        rolePayload.moderator,
        '👤 Modified By',
      );
      if (moderatorField) fields.push(moderatorField);
      break;
    }

    case 'channelUpdate': {
      fields.push({
        name: '📝 Channel Information',
        value: [
          `**Channel:** <#${payload.channel.id}>`,
          `**Type:** ${CHANNEL_TYPES[payload.channel.type]}`,
          payload.oldName !== payload.newName
            ? `**Name Change:** ${payload.oldName} → ${payload.newName}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
        inline: false,
      });

      if (payload.oldPermissions && payload.newPermissions) {
        const permissionChanges = createPermissionChangeFields(
          payload.oldPermissions,
          payload.newPermissions,
        );
        fields.push(...permissionChanges);
      }

      const moderatorField = createModeratorField(
        payload.moderator,
        '👤 Modified By',
      );
      if (moderatorField) fields.push(moderatorField);
      break;
    }

    case 'channelCreate':
    case 'channelDelete': {
      fields.push(
        { name: 'Channel', value: `<#${payload.channel.id}>`, inline: true },
        {
          name: 'Type',
          value:
            CHANNEL_TYPES[payload.channel.type] || String(payload.channel.type),
          inline: true,
        },
      );
      const moderatorField = createModeratorField(
        payload.moderator,
        'Created/Deleted By',
      );
      if (moderatorField) fields.push(moderatorField);
      break;
    }
  }

  const logEmbed = {
    color: ACTION_COLORS[payload.action] || ACTION_COLORS.default,
    title: `${getEmojiForAction(payload.action)} ${payload.action.toUpperCase()}`,
    fields: fields.filter(Boolean),
    timestamp: new Date().toISOString(),
    footer: {
      text: `ID: ${getLogItemId(payload)}`,
    },
  };

  await logChannel.send({
    embeds: [logEmbed],
    components: components.length ? components : undefined,
  });
}
