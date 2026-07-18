export interface BonusEntries {
  levels?: { threshold: number; entries: number }[];
  messages?: { threshold: number; entries: number }[];
  roles?: { id: string; entries: number }[];
}

export interface GiveawaySession {
  bonusEntries?: BonusEntries;
  channelId?: string;
  duration?: string;
  endTime?: Date;
  pingRoleId?: string;
  prize?: string;
  requirements: {
    level?: number;
    roleId?: string;
    messageCount?: number;
    requireAll: boolean;
  };
  step: number;
  winnerCount: number;
}

export interface GiveawayEmbedParams {
  bonusEntries?: BonusEntries;
  endTime?: Date;
  footerText?: string;
  hostId: string;
  id?: number;
  isEnded?: boolean;
  participantCount?: number;
  prize: string;
  requireAllCriteria?: boolean | null;
  requiredLevel?: number | null;
  requiredMessageCount?: number | null;
  requiredRoleId?: string | null;
  winnerCount?: number;
  winnersIds?: string[] | null;
}
