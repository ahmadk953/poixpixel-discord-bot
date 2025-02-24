import {
  Guild,
  GuildMember,
  Message,
  Role,
  GuildChannel,
  PermissionsBitField,
} from 'discord.js';

export type ModerationActionType =
  | 'ban'
  | 'kick'
  | 'mute'
  | 'unban'
  | 'unmute'
  | 'warn';
export type MessageActionType = 'messageDelete' | 'messageEdit';
export type MemberActionType =
  | 'memberJoin'
  | 'memberLeave'
  | 'memberUsernameUpdate'
  | 'memberNicknameUpdate';
export type RoleActionType =
  | 'roleAdd'
  | 'roleRemove'
  | 'roleCreate'
  | 'roleDelete'
  | 'roleUpdate';
export type ChannelActionType =
  | 'channelCreate'
  | 'channelDelete'
  | 'channelUpdate';

export type LogActionType =
  | ModerationActionType
  | MessageActionType
  | MemberActionType
  | RoleActionType
  | ChannelActionType;

export type RoleProperties = {
  name: string;
  color: string;
  hoist: boolean;
  mentionable: boolean;
};

export interface BaseLogAction {
  guild: Guild;
  action: LogActionType;
  moderator?: GuildMember;
  reason?: string;
  duration?: string;
}

export interface ModerationLogAction extends BaseLogAction {
  action: ModerationActionType;
  target: GuildMember;
  moderator: GuildMember;
  reason: string;
  duration?: string;
}

export interface MessageLogAction extends BaseLogAction {
  action: MessageActionType;
  message: Message<true>;
  oldContent?: string;
  newContent?: string;
}

export interface MemberLogAction extends BaseLogAction {
  action: 'memberJoin' | 'memberLeave';
  member: GuildMember;
}

export interface MemberUpdateAction extends BaseLogAction {
  action: 'memberUsernameUpdate' | 'memberNicknameUpdate';
  member: GuildMember;
  oldValue: string;
  newValue: string;
}

export interface RoleLogAction extends BaseLogAction {
  action: 'roleAdd' | 'roleRemove';
  member: GuildMember;
  role: Role;
  moderator?: GuildMember;
}

export interface RoleUpdateAction extends BaseLogAction {
  action: 'roleUpdate';
  role: Role;
  oldRole: Partial<RoleProperties>;
  newRole: Partial<RoleProperties>;
  oldPermissions: Readonly<PermissionsBitField>;
  newPermissions: Readonly<PermissionsBitField>;
  moderator?: GuildMember;
}

export interface RoleCreateDeleteAction extends BaseLogAction {
  action: 'roleCreate' | 'roleDelete';
  role: Role;
  moderator?: GuildMember;
}

export interface ChannelLogAction extends BaseLogAction {
  action: ChannelActionType;
  channel: GuildChannel;
  oldName?: string;
  newName?: string;
  oldPermissions?: Readonly<PermissionsBitField>;
  newPermissions?: Readonly<PermissionsBitField>;
  moderator?: GuildMember;
}

export type LogActionPayload =
  | ModerationLogAction
  | MessageLogAction
  | MemberLogAction
  | MemberUpdateAction
  | RoleLogAction
  | RoleCreateDeleteAction
  | RoleUpdateAction
  | ChannelLogAction;
