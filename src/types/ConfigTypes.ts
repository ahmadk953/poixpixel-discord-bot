export interface Config {
  token: string;
  clientId: string;
  guildId: string;
  dbConnectionString: string;
  channels: {
    welcome: string;
    logs: string;
  };
  roles: {
    joinRoles: string[];
  };
}
