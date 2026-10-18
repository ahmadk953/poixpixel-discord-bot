import type { AuditLogEvent, Collection, Guild } from 'discord.js';

export const AUDIT_LOG_WINDOW_MS = 15_000;

export type GuildAuditLogsEntry =
  Awaited<ReturnType<Guild['fetchAuditLogs']>> extends {
    entries: Collection<string, infer Entry>;
  }
    ? Entry
    : never;

export const isRecentAuditLogEntry = (
  entry: GuildAuditLogsEntry,
  targetId: string
): boolean => {
  const target = entry.target;
  if (!target || typeof target !== 'object' || !('id' in target)) {
    return false;
  }

  return (
    target.id === targetId &&
    Date.now() - entry.createdTimestamp < AUDIT_LOG_WINDOW_MS
  );
};

export const isAuditLogEntryByBot = (
  entry: GuildAuditLogsEntry,
  botUserId?: string
): boolean => entry.executor?.id === botUserId;

export const fetchRecentAuditLogEntry = async (
  guild: Guild,
  type: AuditLogEvent,
  targetId: string,
  predicate?: (entry: GuildAuditLogsEntry) => boolean
): Promise<GuildAuditLogsEntry | undefined> => {
  const windowStart = Date.now() - AUDIT_LOG_WINDOW_MS;
  let before: string | undefined;

  while (true) {
    const auditLogs = await guild.fetchAuditLogs({
      type,
      limit: 100,
      before,
    });

    let lastEntryId: string | undefined;
    for (const entry of auditLogs.entries.values()) {
      if (entry.createdTimestamp < windowStart) {
        // Entries are newest-first, so nothing older can match the window.
        return;
      }

      if (
        isRecentAuditLogEntry(entry, targetId) &&
        (!predicate || predicate(entry))
      ) {
        return entry;
      }

      lastEntryId = entry.id;
    }

    if (!lastEntryId) {
      return;
    }

    before = lastEntryId;
  }
};
