import type * as schema from '../../schema.js';

export function normalizeModerationDates(
  record: schema.moderationTableTypes
): schema.moderationTableTypes {
  const createdAt =
    record.createdAt == null ? null : new Date(record.createdAt);
  const expiresAt =
    record.expiresAt == null ? null : new Date(record.expiresAt);

  return {
    ...record,
    createdAt:
      createdAt != null && !Number.isNaN(createdAt.getTime())
        ? createdAt
        : (record.createdAt as Date),
    expiresAt:
      expiresAt != null && !Number.isNaN(expiresAt.getTime())
        ? expiresAt
        : null,
  };
}
