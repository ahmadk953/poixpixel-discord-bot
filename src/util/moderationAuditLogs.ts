import type { AuditLogEvent, Collection, Guild } from 'discord.js';

export const AUDIT_LOG_WINDOW_MS = 15_000;

type GuildAuditLogsEntry =
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
  const auditLogs = await guild.fetchAuditLogs({
    type,
    limit: 5,
  });

  return auditLogs.entries.find((entry) => {
    if (!isRecentAuditLogEntry(entry, targetId)) {
      return false;
    }

    return predicate ? predicate(entry) : true;
  });
};
