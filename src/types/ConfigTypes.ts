/**
 * Config interface for the bot
 */
export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  serverInvite: string;
  database: {
    dbConnectionString: string;
    maxRetryAttempts: number;
    retryDelay: number;
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
}
