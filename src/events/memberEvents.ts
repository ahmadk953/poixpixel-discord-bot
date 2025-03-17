import {
  Collection,
  Events,
  Guild,
  GuildMember,
  PartialGuildMember,
} from 'discord.js';

import { updateMember, setMembers } from '../db/db.js';
import { generateMemberBanner } from '../util/helpers.js';
import { loadConfig } from '../util/configLoader.js';
import { Event } from '../types/EventTypes.js';
import logAction from '../util/logging/logAction.js';

export const memberJoin: Event<typeof Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,
  execute: async (member: GuildMember) => {
    const { guild } = member;
    const config = loadConfig();
    const welcomeChannel = guild.channels.cache.get(config.channels.welcome);

    if (!welcomeChannel?.isTextBased()) {
      console.error('Welcome channel not found or is not a text channel');
      return;
    }

    try {
      const memberCollection = new Collection<string, GuildMember>();
      memberCollection.set(member.user.id, member);
      await setMembers(memberCollection);

      if (!member.user.bot) {
        const attachment = await generateMemberBanner({
          member,
          width: 1024,
          height: 450,
        });

        await Promise.all([
          welcomeChannel.send({
            content: `Welcome to ${guild.name}, ${member}!`,
            files: [attachment],
          }),
          member.send({
            content: `Welcome to ${guild.name}, we hope you enjoy your stay!`,
            files: [attachment],
          }),
          member.roles.add(config.roles.joinRoles),
          logAction({
            guild,
            action: 'memberJoin',
            member,
          }),
        ]);
      }
    } catch (error) {
      console.error('Error handling new member:', error);
    }
  },
};

export const memberLeave: Event<typeof Events.GuildMemberRemove> = {
  name: Events.GuildMemberRemove,
  execute: async (member: GuildMember | PartialGuildMember) => {
    const { guild } = member;

    try {
      await Promise.all([
        updateMember({
          discordId: member.user.id,
          currentlyInServer: false,
        }),
        logAction({
          guild,
          action: 'memberLeave',
          member: member as GuildMember,
        }),
      ]);
    } catch (error) {
      console.error('Error handling member leave:', error);
    }
  },
};

export const memberUpdate: Event<typeof Events.GuildMemberUpdate> = {
  name: Events.GuildMemberUpdate,
  execute: async (
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ) => {
    const { guild } = newMember;

    try {
      if (oldMember.user.username !== newMember.user.username) {
        await updateMember({
          discordId: newMember.user.id,
          discordUsername: newMember.user.username,
        });

        await logAction({
          guild,
          action: 'memberUsernameUpdate',
          member: newMember,
          oldValue: oldMember.user.username,
          newValue: newMember.user.username,
        });
      }

      if (oldMember.nickname !== newMember.nickname) {
        await logAction({
          guild,
          action: 'memberNicknameUpdate',
          member: newMember,
          oldValue: oldMember.nickname ?? oldMember.user.username,
          newValue: newMember.nickname ?? newMember.user.username,
        });
      }

      const addedRoles = newMember.roles.cache.filter(
        (role) => !oldMember.roles.cache.has(role.id),
      );

      const removedRoles = oldMember.roles.cache.filter(
        (role) => !newMember.roles.cache.has(role.id),
      );

      if (addedRoles.size > 0) {
        for (const role of addedRoles.values()) {
          await logAction({
            guild,
            action: 'roleAdd',
            member: newMember,
            role,
          });
        }
      }

      if (removedRoles.size > 0) {
        for (const role of removedRoles.values()) {
          await logAction({
            guild,
            action: 'roleRemove',
            member: newMember,
            role,
          });
        }
      }
    } catch (error) {
      console.error('Error handling member update:', error);
    }
  },
};

export default [memberJoin, memberLeave, memberUpdate];
