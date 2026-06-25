import type { APIEmbedField, GuildMember } from 'discord.js';

import type { MemberUpdateAction } from '../types.js';
import { createUserField } from '../utils.js';

/**
 * Build embed fields for member join/leave actions.
 */
export const handleMemberJoinLeaveAction = (
  member: GuildMember,
  fields: APIEmbedField[]
): void => {
  fields.push(createUserField(member, 'User'), {
    name: 'Account Created',
    value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
    inline: true,
  });
};

/**
 * Build embed fields for member username/nickname updates.
 */
export const handleMemberNameUpdateAction = (
  payload: MemberUpdateAction,
  fields: APIEmbedField[]
): void => {
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
};
