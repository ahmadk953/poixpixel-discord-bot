import { and, eq, isNull, sql } from 'drizzle-orm';

import {
  db,
  ensureDbInitialized,
  handleDbError,
  invalidateCache,
  withCache,
} from '../db.js';
import * as schema from '../schema.js';

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
}: schema.factTableTypes): Promise<void> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot add fact');
    }

    await db.insert(schema.factTable).values({
      content,
      source,
      addedBy,
      approved,
    });

    await invalidateCache('unused-facts');
  } catch (error) {
    handleDbError('Failed to add fact', error as Error);
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
      console.error('Database not initialized, cannot get last inserted fact');
    }

    const result = await db
      .select({ id: sql<number>`MAX(${schema.factTable.id})` })
      .from(schema.factTable);

    return result[0]?.id ?? 0;
  } catch (error) {
    return handleDbError('Failed to get last inserted fact ID', error as Error);
  }
}

/**
 * Get a random fact that hasn't been used yet
 * @returns Random fact object
 */
export async function getRandomUnusedFact(): Promise<schema.factTableTypes> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get random unused fact');
    }

    const cacheKey = 'unused-facts';
    const facts = await withCache<schema.factTableTypes[]>(
      cacheKey,
      async () => {
        return (await db
          .select()
          .from(schema.factTable)
          .where(
            and(
              eq(schema.factTable.approved, true),
              isNull(schema.factTable.usedOn),
            ),
          )) as schema.factTableTypes[];
      },
    );

    if (facts.length === 0) {
      await db
        .update(schema.factTable)
        .set({ usedOn: null })
        .where(eq(schema.factTable.approved, true));

      await invalidateCache(cacheKey);
      return await getRandomUnusedFact();
    }

    return facts[
      Math.floor(Math.random() * facts.length)
    ] as schema.factTableTypes;
  } catch (error) {
    return handleDbError('Failed to get random fact', error as Error);
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
      console.error('Database not initialized, cannot mark fact as used');
    }

    await db
      .update(schema.factTable)
      .set({ usedOn: new Date() })
      .where(eq(schema.factTable.id, id));

    await invalidateCache('unused-facts');
  } catch (error) {
    handleDbError('Failed to mark fact as used', error as Error);
  }
}

/**
 * Get all pending facts that need approval
 * @returns Array of pending fact objects
 */
export async function getPendingFacts(): Promise<schema.factTableTypes[]> {
  try {
    await ensureDbInitialized();

    if (!db) {
      console.error('Database not initialized, cannot get pending facts');
    }

    return (await db
      .select()
      .from(schema.factTable)
      .where(eq(schema.factTable.approved, false))) as schema.factTableTypes[];
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
      console.error('Database not initialized, cannot approve fact');
    }

    await db
      .update(schema.factTable)
      .set({ approved: true })
      .where(eq(schema.factTable.id, id));

    await invalidateCache('unused-facts');
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
      console.error('Database not initialized, cannot delete fact');
    }

    await db.delete(schema.factTable).where(eq(schema.factTable.id, id));

    await invalidateCache('unused-facts');
  } catch (error) {
    return handleDbError('Failed to delete fact', error as Error);
  }
}
