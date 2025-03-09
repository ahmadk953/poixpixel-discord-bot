export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  dbConnectionString: string;
  redisConnectionString: string;
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
}
