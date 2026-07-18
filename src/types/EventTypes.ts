import type { ClientEvents } from 'discord.js';

/**
 * Event interface for events
 */
export interface Event<K extends keyof ClientEvents> {
  execute: (...args: ClientEvents[K]) => Promise<void>;
  name: K;
  once?: boolean;
}
