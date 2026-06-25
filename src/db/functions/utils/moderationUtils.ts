import type * as schema from '../../schema.js';

export function normalizeModerationDates(
  record: schema.moderationTableTypes
): schema.moderationTableTypes {
  const createdAt =
    record.createdAt == null ? null : new Date(record.createdAt);
  const expiresAt =
    record.expiresAt == null ? null : new Date(record.expiresAt);

  if (createdAt == null || Number.isNaN(createdAt.getTime())) {
    throw new Error('Invalid moderation record createdAt value');
  }

  return {
    ...record,
    createdAt,
    expiresAt:
      expiresAt != null && !Number.isNaN(expiresAt.getTime())
        ? expiresAt
        : null,
  };
}
