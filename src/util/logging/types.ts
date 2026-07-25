import type {
  Guild,
  GuildChannel,
  GuildMember,
  Message,
  PermissionsBitField,
  Role,
  User,
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
// Add purge as message action for structured logging
export type PurgeActionType = 'purge';

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
  | PurgeActionType
  | ChannelActionType;

/**
 * Properties of a role
 */
export interface RoleProperties {
  color: string;
  hoist: boolean;
  mentionable: boolean;
  name: string;
}

/**
 * Base log action properties
 */
export interface BaseLogAction {
  action: LogActionType;
  duration?: string;
  guild: Guild;
  moderator?: GuildMember;
  reason?: string;
}

/**
 * Log action properties for moderation actions
 */
export interface ModerationLogAction extends BaseLogAction {
  action: ModerationActionType;
  duration?: string;
  moderator: GuildMember;
  reason: string;
  target: GuildMember | User;
}

/**
 * Log action properties for message actions
 */
export interface MessageLogAction extends BaseLogAction {
  action: MessageActionType;
  message: Message<true>;
  newContent?: string;
  oldContent?: string;
}

/**
 * Purge log action
 */
export interface PurgeLogAction extends BaseLogAction {
  action: 'purge';
  ageLimit: string;
  channel: GuildChannel;
  deletedMessages: Message[];
  moderator: GuildMember;
  reason: string;
  skippedCount: number;
  targetUser?: User;
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
  newValue: string;
  oldValue: string;
}

/**
 * Log action properties for role actions
 */
export interface RoleLogAction extends BaseLogAction {
  action: 'roleAdd' | 'roleRemove';
  member: GuildMember;
  moderator?: GuildMember;
  role: Role;
}

/**
 * Log action properties for role updates
 */
export interface RoleUpdateAction extends BaseLogAction {
  action: 'roleUpdate';
  moderator?: GuildMember;
  newPermissions: Readonly<PermissionsBitField>;
  newRole: Partial<RoleProperties>;
  oldPermissions: Readonly<PermissionsBitField>;
  oldRole: Partial<RoleProperties>;
  role: Role;
}

/**
 * Log action properties for role creation or deletion
 */
export interface RoleCreateDeleteAction extends BaseLogAction {
  action: 'roleCreate' | 'roleDelete';
  moderator?: GuildMember;
  role: Role;
}

/**
 * Log action properties for channel actions
 */
export interface ChannelLogAction extends BaseLogAction {
  action: ChannelActionType;
  channel: GuildChannel;
  moderator?: GuildMember;
  newName?: string;
  newParentId?: string | null;
  newSlowmode?: number;
  oldName?: string;
  oldParentId?: string | null;
  oldSlowmode?: number;
  permissionChanges?: {
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
  }[];
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
  | ChannelLogAction
  | PurgeLogAction;
