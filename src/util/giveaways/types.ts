export interface BonusEntries {
  roles?: { id: string; entries: number }[];
  levels?: { threshold: number; entries: number }[];
  messages?: { threshold: number; entries: number }[];
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
  winnersIds?: string[] | null;
  isEnded?: boolean;
  footerText?: string;
  requiredLevel?: number | null;
  requiredRoleId?: string | null;
  requiredMessageCount?: number | null;
  requireAllCriteria?: boolean | null;
  bonusEntries?: BonusEntries;
}
