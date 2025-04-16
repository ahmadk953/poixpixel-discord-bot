export interface BonusEntries {
  roles?: Array<{ id: string; entries: number }>;
  levels?: Array<{ threshold: number; entries: number }>;
  messages?: Array<{ threshold: number; entries: number }>;
}

export interface GiveawaySession {
  step: number;
  prize?: string;
  duration?: string;
  endTime?: Date;
  winnerCount: number;
  channelId?: string;
  requirements: {
    level?: number;
    roleId?: string;
    messageCount?: number;
    requireAll: boolean;
  };
  pingRoleId?: string;
  bonusEntries?: BonusEntries;
}

export interface GiveawayEmbedParams {
  id?: number;
  prize: string;
  endTime?: Date;
  winnerCount?: number;
  hostId: string;
  participantCount?: number;
  winnersIds?: string[];
  isEnded?: boolean;
  footerText?: string;
  requiredLevel?: number;
  requiredRoleId?: string;
  requiredMessageCount?: number;
  requireAllCriteria?: boolean;
  bonusEntries?: BonusEntries;
}
