/**
 * Config interface for the bot
 */
export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  serverInvite: string;
  database: {
    poolingDbConnectionString: string;
    directDbConnectionString: string;
    maxRetryAttempts: number;
    retryDelay: number;
    queryRetryAttempts: number;
    queryRetryInitialDelay: number;
  };
  redis: {
    redisConnectionString: string;
    retryAttempts: number;
    initialRetryDelay: number;
  };
  channels: {
    welcome: string;
    logs: string;
    counting: string;
    factOfTheDay: string;
    factApproval: string;
    advancements: string;
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
  leveling: {
    xpCooldown: number;
    minXpAwarded: number;
    maxXpAwarded: number;
  };
  counting: {
    warningPeriod: string;
    mistakeThreshold: number;
    maxWarnings: number;
    autoBanDuration: string;
  };
  dataRetention?: {
    deleteAfterDays?: number;
    postBanGraceDays?: number;
  };
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
}
