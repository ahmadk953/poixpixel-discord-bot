import type * as schema from '../../schema.js';

export function normalizeModerationDates(
  record: schema.moderationTableTypes
): schema.moderationTableTypes {
  const createdAt =
    record.createdAt == null ? undefined : new Date(record.createdAt);
  const expiresAt =
    record.expiresAt == null ? undefined : new Date(record.expiresAt);

  return {
    ...record,
    createdAt: Number.isNaN(createdAt?.getTime()) ? undefined : createdAt,
    expiresAt: Number.isNaN(expiresAt?.getTime()) ? undefined : expiresAt,
  };
}
