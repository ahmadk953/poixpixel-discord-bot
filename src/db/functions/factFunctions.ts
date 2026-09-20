import { and, eq, isNull, sql } from 'drizzle-orm';

import { logger } from '@/util/logger.js';
import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
  withDbRetryDrizzle,
} from '../db.js';
import { factTable, type factTableTypes } from '../schema.js';

/**
 * Add a new fact to the database
 * @param content - Content of the fact
 * @param source - Source of the fact
 * @param addedBy - Discord ID of the user who added the fact
 * @param approved - Whether the fact is approved or not
 */
export async function addFact({
  content,
  source,
  addedBy,
  approved = false,
}: factTableTypes): Promise<number> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot add fact'
      );
      throw new Error('Database not initialized');
    }

    const result = await db
      .insert(factTable)
      .values({
        content,
        source,
        addedBy,
        approved,
      })
      .returning({ id: factTable.id });

    if (!result?.[0] || result[0].id == null) {
      return handleDbError(
        'No row returned after insert',
        new Error('No row returned after insert')
      );
    }

    await invalidateCache('facts:unused-facts');
    await invalidateCache('facts:all-facts');

    return result[0].id;
  } catch (error) {
    return handleDbError('Failed to add fact', error as Error);
  }
}

/**
 * Get the ID of the most recently added fact
 * @returns ID of the last inserted fact
 */
export async function getLastInsertedFactId(): Promise<number> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot get last inserted fact'
      );
      throw new Error('Database not initialized');
    }

    const result = await withDbRetryDrizzle(
      async () =>
        await db
          .select({ id: sql<number>`MAX(${factTable.id})` })
          .from(factTable),
      {
        operationName: 'get-last-inserted-fact-id',
      }
    );

    return result[0]?.id ?? 0;
  } catch (error) {
    return handleDbError('Failed to get last inserted fact ID', error as Error);
  }
}

/**
 * Get a random fact that hasn't been used yet
 * @returns Random fact object
 */
export async function getRandomUnusedFact(): Promise<factTableTypes | null> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot get random unused fact'
      );
      throw new Error('Database not initialized');
    }

    const cacheKey = 'facts:unused-facts';

    // Try to get cached facts first
    let facts = await withCache<factTableTypes[]>(
      cacheKey,
      async () =>
        await withDbRetryDrizzle(
          async () =>
            (await db
              .select()
              .from(factTable)
              .where(
                and(eq(factTable.approved, true), isNull(factTable.usedOn))
              )) as factTableTypes[],
          {
            operationName: 'get-facts:unused-facts',
          }
        ),
      3600 // Cache for 1 hour
    );

    if (facts.length === 0) {
      await withDbRetryDrizzle(
        async () =>
          await db
            .update(factTable)
            .set({ usedOn: null })
            .where(eq(factTable.approved, true)),
        {
          operationName: 'reset-used-facts',
          forceRetry: true,
        }
      );

      await invalidateCache(cacheKey);

      // Re-query to confirm there are approved, unused facts now.
      const rechecked = await withDbRetryDrizzle(
        async () =>
          (await db
            .select()
            .from(factTable)
            .where(
              and(eq(factTable.approved, true), isNull(factTable.usedOn))
            )) as factTableTypes[],
        {
          operationName: 'get-facts:unused-facts-after-reset',
        }
      );

      if (!rechecked || rechecked.length === 0) {
        // No approved facts exist; return sentinel so callers can handle it.
        return null;
      }

      facts = rechecked;
    }

    // Improved selection algorithm to avoid always picking the same facts
    // This uses a weighted random selection that considers how often facts were used recently
    const weightedFacts = facts.map((fact) => {
      // Calculate a weight based on how long ago this fact was last used
      // Facts used more recently get lower weights (they're less likely to be selected)
      if (!fact.usedOn) {
        return { ...fact, weight: 100 }; // Never used gets high weight
      }

      const timeSinceUsed = Date.now() - fact.usedOn.getTime();
      // Facts used more than a week ago get full weight (100)
      // Facts used less than an hour ago get 0 weight
      const weight = Math.max(0, 100 - timeSinceUsed / (1000 * 60 * 60));

      return { ...fact, weight };
    });

    // Sort by weights descending and pick a random fact from the top 75% to add more randomness
    weightedFacts.sort((a, b) => b.weight - a.weight);
    const topFacts = weightedFacts.slice(
      0,
      Math.max(1, Math.floor(weightedFacts.length * 0.75))
    );

    return topFacts[
      Math.floor(Math.random() * topFacts.length)
    ] as factTableTypes;
  } catch (error) {
    logger.error('[factDbFunctions] Error in getRandomUnusedFact', error);
    throw handleDbError('Failed to get random fact', error as Error);
  }
}

/**
 * Mark a fact as used
 * @param id - ID of the fact to mark as used
 */
export async function markFactAsUsed(id: number): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot mark fact as used'
      );
      throw new Error('Database not initialized');
    }

    await db
      .update(factTable)
      .set({ usedOn: new Date() })
      .where(eq(factTable.id, id));

    // Invalidate the cache so next query gets fresh data
    await invalidateCache('facts:unused-facts');

    logger.info(
      `[factDbFunctions] Fact ${id} marked as used and cache invalidated`
    );
  } catch (error) {
    logger.error('[factDbFunctions] Error marking fact as used', error);
    throw handleDbError('Failed to mark fact as used', error as Error);
  }
}

/**
 * Get all facts that are approved and can be used
 * @returns Array of approved facts
 */
export async function getAllApprovedFacts(): Promise<factTableTypes[]> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot get all approved facts'
      );
      throw new Error('Database not initialized');
    }

    const cacheKey = 'facts:all-facts';
    return await withCache<factTableTypes[]>(
      cacheKey,
      async () =>
        await withDbRetryDrizzle(
          async () =>
            (await db
              .select()
              .from(factTable)
              .where(eq(factTable.approved, true))
              .orderBy(factTable.addedAt)) as factTableTypes[],
          {
            operationName: 'get-all-approved-facts',
          }
        ),
      3600 // Cache for 1 hour
    );
  } catch (error) {
    return handleDbError('Failed to get all approved facts', error as Error);
  }
}

/**
 * Get all pending facts that need approval
 * @returns Array of pending fact objects
 */
export async function getPendingFacts(): Promise<factTableTypes[]> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot get pending facts'
      );
      throw new Error('Database not initialized');
    }

    return await withDbRetryDrizzle(
      async () =>
        (await db
          .select()
          .from(factTable)
          .where(eq(factTable.approved, false))) as factTableTypes[],
      {
        operationName: 'get-pending-facts',
      }
    );
  } catch (error) {
    return handleDbError('Failed to get pending facts', error as Error);
  }
}

/**
 * Approve a fact
 * @param id - ID of the fact to approve
 */
export async function approveFact(id: number): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot approve fact'
      );
      throw new Error('Database not initialized');
    }

    await withDbRetryDrizzle(
      async () =>
        await db
          .update(factTable)
          .set({ approved: true })
          .where(eq(factTable.id, id)),
      {
        operationName: 'approve-fact',
        forceRetry: true,
      }
    );

    await invalidateCache('facts:unused-facts');
  } catch (error) {
    handleDbError('Failed to approve fact', error as Error);
  }
}

/**
 * Delete a fact
 * @param id - ID of the fact to delete
 */
export async function deleteFact(id: number): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      logger.error(
        '[factDbFunctions] Database not initialized, cannot delete fact'
      );
      throw new Error('Database not initialized');
    }

    await withDbRetryDrizzle(
      async () => await db.delete(factTable).where(eq(factTable.id, id)),
      {
        operationName: 'delete-fact',
        forceRetry: true,
      }
    );

    await invalidateCache('facts:unused-facts');
  } catch (error) {
    return handleDbError('Failed to delete fact', error as Error);
  }
}
