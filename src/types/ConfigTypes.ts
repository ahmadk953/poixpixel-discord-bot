/**
 * Config interface for the bot
 */
export interface Config {
  channels: {
    welcome: string;
    logs: string;
    counting: string;
    factOfTheDay: string;
    factApproval: string;
    advancements: string;
  };
  clientId: string;
  counting: {
    warningPeriod: string;
    mistakeThreshold: number;
    maxWarnings: number;
    autoBanDuration: string;
  };
  database: {
    poolingDbConnectionString: string;
    directDbConnectionString: string;
    maxRetryAttempts: number;
    retryDelay: number;
    queryRetryAttempts: number;
    queryRetryInitialDelay: number;
  };
  dataRetention?: {
    deleteAfterDays?: number;
    postBanGraceDays?: number;
  };
  guildId: string;
  leveling: {
    xpCooldown: number;
    minXpAwarded: number;
    maxXpAwarded: number;
  };
  redis: {
    redisConnectionString: string;
    retryAttempts: number;
    initialRetryDelay: number;
    cacheKeyPrefix: string;
  };
  roles: {
    joinRoles: string[];
    levelRoles: {
      level: number;
      roleId: string;
    }[];
    staffRoles: {
      name: string;
      roleId: string;
    }[];
    factPingRole: string;
  };
  serverInvite: string;
  telemetry?: {
    level?: 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
    otel?: {
      enabled?: boolean;
      serviceName?: string;
      otlpEndpoint?: string;
      headers?: Record<string, string>;
      resourceAttributes?: Record<string, string>;
      batch?: {
        maxQueueSize?: number;
        scheduledDelayMillis?: number;
        exportTimeoutMillis?: number;
        maxExportBatchSize?: number;
      };
    };
  };
  token: string;
}
