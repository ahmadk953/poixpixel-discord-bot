import { ClientEvents } from 'discord.js';

/**
 * Event interface for events
 */
export interface Event<K extends keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (...args: ClientEvents[K]) => Promise<void>;
}
