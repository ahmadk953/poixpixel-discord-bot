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
  };
  roles: {
    joinRoles: string[];
    factPingRole: string;
  };
}
