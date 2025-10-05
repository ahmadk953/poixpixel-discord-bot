import {
  Events,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js';

import { Event } from '@/types/EventTypes.js';
import {
  decrementUserReactionCount,
  incrementUserReactionCount,
} from '@/db/db.js';
import { processReactionAchievements } from '@/util/achievementManager.js';
import { logger } from '@/util/logger.js';

export const reactionAdd: Event<typeof Events.MessageReactionAdd> = {
  name: Events.MessageReactionAdd,
  execute: async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) => {
    try {
      if (user.bot || !reaction.message.guild) return;

      await incrementUserReactionCount(user.id);

      await processReactionAchievements(user.id, reaction.message.guild);
    } catch (error) {
      logger.error('[ReactionEvents] Error handling reaction add', error);
    }
  },
};

export const reactionRemove: Event<typeof Events.MessageReactionRemove> = {
  name: Events.MessageReactionRemove,
  execute: async (
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) => {
    try {
      if (user.bot || !reaction.message.guild) return;

      await decrementUserReactionCount(user.id);

      await processReactionAchievements(user.id, reaction.message.guild, true);
    } catch (error) {
      logger.error('[ReactionEvents] Error handling reaction remove', error);
    }
  },
};

export default [reactionAdd, reactionRemove];
