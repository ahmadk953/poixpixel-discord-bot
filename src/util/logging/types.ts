import {
  Guild,
  GuildMember,
  Message,
  Role,
  GuildChannel,
  PermissionsBitField,
} from 'discord.js';

/**
 * Moderation log action types
 */
export type ModerationActionType =
  | 'ban'
  | 'kick'
  | 'mute'
  | 'unban'
  | 'unmute'
  | 'warn'
  | 'countingWarning'
  | 'clearCountingWarnings'
  | 'countingBan'
  | 'countingUnban';

/**
 * Message log action types
 */
export type MessageActionType = 'messageDelete' | 'messageEdit';

/**
 * Member log action types
 */
export type MemberActionType =
  | 'memberJoin'
  | 'memberLeave'
  | 'memberUsernameUpdate'
  | 'memberNicknameUpdate';

/**
 * Role log action types
 */
export type RoleActionType =
  | 'roleAdd'
  | 'roleRemove'
  | 'roleCreate'
  | 'roleDelete'
  | 'roleUpdate';

/**
 * Channel log action types
 */
export type ChannelActionType =
  | 'channelCreate'
  | 'channelDelete'
  | 'channelUpdate';

/**
 * All log action types
 */
export type LogActionType =
  | ModerationActionType
  | MessageActionType
  | MemberActionType
  | RoleActionType
  | ChannelActionType;

/**
 * Properties of a role
 */
export type RoleProperties = {
  name: string;
  color: string;
  hoist: boolean;
  mentionable: boolean;
};

/**
 * Base log action properties
 */
export interface BaseLogAction {
  guild: Guild;
  action: LogActionType;
  moderator?: GuildMember;
  reason?: string;
  duration?: string;
}

/**
 * Log action properties for moderation actions
 */
export interface ModerationLogAction extends BaseLogAction {
  action: ModerationActionType;
  target: GuildMember;
  moderator: GuildMember;
  reason: string;
  duration?: string;
}

/**
 * Log action properties for message actions
 */
export interface MessageLogAction extends BaseLogAction {
  action: MessageActionType;
  message: Message<true>;
  oldContent?: string;
  newContent?: string;
}

/**
 * Log action properties for member actions
 */
export interface MemberLogAction extends BaseLogAction {
  action: 'memberJoin' | 'memberLeave';
  member: GuildMember;
}

/**
 * Log action properties for member username or nickname updates
 */
export interface MemberUpdateAction extends BaseLogAction {
  action: 'memberUsernameUpdate' | 'memberNicknameUpdate';
  member: GuildMember;
  oldValue: string;
  newValue: string;
}

/**
 * Log action properties for role actions
 */
export interface RoleLogAction extends BaseLogAction {
  action: 'roleAdd' | 'roleRemove';
  member: GuildMember;
  role: Role;
  moderator?: GuildMember;
}

/**
 * Log action properties for role updates
 */
export interface RoleUpdateAction extends BaseLogAction {
  action: 'roleUpdate';
  role: Role;
  oldRole: Partial<RoleProperties>;
  newRole: Partial<RoleProperties>;
  oldPermissions: Readonly<PermissionsBitField>;
  newPermissions: Readonly<PermissionsBitField>;
  moderator?: GuildMember;
}

/**
 * Log action properties for role creation or deletion
 */
export interface RoleCreateDeleteAction extends BaseLogAction {
  action: 'roleCreate' | 'roleDelete';
  role: Role;
  moderator?: GuildMember;
}

/**
 * Log action properties for channel actions
 */
export interface ChannelLogAction extends BaseLogAction {
  action: ChannelActionType;
  channel: GuildChannel;
  oldName?: string;
  newName?: string;
  permissionChanges?: Array<{
    action: 'added' | 'modified' | 'removed';
    targetId: string;
    targetType: 'role' | 'member';
    targetName: string;
    allow?: Readonly<PermissionsBitField>;
    deny?: Readonly<PermissionsBitField>;
    oldAllow?: Readonly<PermissionsBitField>;
    oldDeny?: Readonly<PermissionsBitField>;
    newAllow?: Readonly<PermissionsBitField>;
    newDeny?: Readonly<PermissionsBitField>;
  }>;
  moderator?: GuildMember;
}

/**
 * Payload for a log action
 */
export type LogActionPayload =
  | ModerationLogAction
  | MessageLogAction
  | MemberLogAction
  | MemberUpdateAction
  | RoleLogAction
  | RoleCreateDeleteAction
  | RoleUpdateAction
  | ChannelLogAction;
