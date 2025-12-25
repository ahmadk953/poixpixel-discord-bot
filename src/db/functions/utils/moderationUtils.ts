import type * as schema from '../../schema.js';

export function normalizeModerationDates(
  record: schema.moderationTableTypes,
): schema.moderationTableTypes {
  const createdAt =
    record.createdAt != null ? new Date(record.createdAt) : undefined;
  const expiresAt =
    record.expiresAt != null ? new Date(record.expiresAt) : undefined;

  return {
    ...record,
    createdAt: Number.isNaN(createdAt?.getTime()) ? undefined : createdAt,
    expiresAt: Number.isNaN(expiresAt?.getTime()) ? undefined : expiresAt,
  };
}
