import { Message } from 'discord.js';

import { getJson, setJson } from '../db/redis.js';

interface CountingData {
  currentCount: number;
  lastUserId: string | null;
  highestCount: number;
  totalCorrect: number;
}

const MILESTONE_REACTIONS = {
  normal: '✅',
  multiples25: '✨',
  multiples50: '⭐',
  multiples100: '🎉',
};

/**
 * Initializes the counting data if it doesn't exist
 * @returns - The initialized counting data
 */
export async function initializeCountingData(): Promise<CountingData> {
  const exists = await getJson<CountingData>('counting');
  if (exists) return exists;

  const initialData: CountingData = {
    currentCount: 0,
    lastUserId: null,
    highestCount: 0,
    totalCorrect: 0,
  };

  await setJson<CountingData>('counting', initialData);
  return initialData;
}

/**
 * Gets the current counting data
 * @returns - The current counting data
 */
export async function getCountingData(): Promise<CountingData> {
  const data = await getJson<CountingData>('counting');
  if (!data) {
    return initializeCountingData();
  }
  return data;
}

/**
 * Updates the counting data with new data
 * @param data - The data to update the counting data with
 */
export async function updateCountingData(
  data: Partial<CountingData>,
): Promise<void> {
  const currentData = await getCountingData();
  const updatedData = { ...currentData, ...data };
  await setJson<CountingData>('counting', updatedData);
}

/**
 * Resets the counting data to the initial state
 * @returns - The current count
 */
export async function resetCounting(): Promise<void> {
  await updateCountingData({
    currentCount: 0,
    lastUserId: null,
  });
  return;
}

/**
 * Processes a counting message to determine if it is valid
 * @param message - The message to process
 * @returns - An object with information about the message
 */
export async function processCountingMessage(message: Message): Promise<{
  isValid: boolean;
  expectedCount?: number;
  isMilestone?: boolean;
  milestoneType?: keyof typeof MILESTONE_REACTIONS;
  reason?: string;
}> {
  try {
    const countingData = await getCountingData();

    const content = message.content.trim();
    const count = Number(content);

    if (isNaN(count) || !Number.isInteger(count)) {
      return {
        isValid: false,
        expectedCount: countingData.currentCount + 1,
        reason: 'not_a_number',
      };
    }

    const expectedCount = countingData.currentCount + 1;
    if (count !== expectedCount) {
      return {
        isValid: false,
        expectedCount,
        reason: count > expectedCount ? 'too_high' : 'too_low',
      };
    }

    if (countingData.lastUserId === message.author.id) {
      return { isValid: false, expectedCount, reason: 'same_user' };
    }

    const newCount = countingData.currentCount + 1;
    const newHighestCount = Math.max(newCount, countingData.highestCount);

    await updateCountingData({
      currentCount: newCount,
      lastUserId: message.author.id,
      highestCount: newHighestCount,
      totalCorrect: countingData.totalCorrect + 1,
    });

    let isMilestone = false;
    let milestoneType: keyof typeof MILESTONE_REACTIONS = 'normal';

    if (newCount % 100 === 0) {
      isMilestone = true;
      milestoneType = 'multiples100';
    } else if (newCount % 50 === 0) {
      isMilestone = true;
      milestoneType = 'multiples50';
    } else if (newCount % 25 === 0) {
      isMilestone = true;
      milestoneType = 'multiples25';
    }

    return {
      isValid: true,
      expectedCount: newCount + 1,
      isMilestone,
      milestoneType,
    };
  } catch (error) {
    console.error('Error processing counting message:', error);
    return { isValid: false, reason: 'error' };
  }
}

/**
 * Adds counting reactions to a message based on the milestone type
 * @param message - The message to add counting reactions to
 * @param milestoneType - The type of milestone to add reactions for
 */
export async function addCountingReactions(
  message: Message,
  milestoneType: keyof typeof MILESTONE_REACTIONS,
): Promise<void> {
  try {
    await message.react(MILESTONE_REACTIONS[milestoneType]);

    if (milestoneType === 'multiples100') {
      await message.react('💯');
    }
  } catch (error) {
    console.error('Error adding counting reactions:', error);
  }
}

/**
 * Gets the current counting status
 * @returns - A string with the current counting status
 */
export async function getCountingStatus(): Promise<string> {
  const data = await getCountingData();
  return `Current count: ${data.currentCount}\nHighest count ever: ${data.highestCount}\nTotal correct counts: ${data.totalCorrect}`;
}

/**
 * Sets the current count to a specific number
 * @param count - The number to set as the current count
 */
export async function setCount(count: number): Promise<void> {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Count must be a non-negative integer.');
  }

  await updateCountingData({
    currentCount: count,
    lastUserId: null,
  });
}
