import { parseDuration } from '../helpers.js';

/**
 * Safely parses a duration string into milliseconds.
 * @param raw The raw duration string to parse.
 * @param fallback The fallback value to return on error.
 * @returns The parsed duration in milliseconds, or the fallback value.
 */
export function safeParseDuration(
  raw: string | undefined,
  fallback: number,
): number {
  try {
    if (!raw) return fallback;
    return parseDuration(raw);
  } catch {
    return fallback;
  }
}
