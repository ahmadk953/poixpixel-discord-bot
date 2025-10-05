import { ClientEvents } from 'discord.js';

/**
 * Event interface for events
 */
export interface Event<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  // eslint-disable-next-line no-unused-vars
  execute: (...args: ClientEvents[K]) => Promise<void>;
}
