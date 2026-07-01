export * from './command';

// Database types
export interface Guild {
  id: string;
  prefix?: string;
  language?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  globalName?: string;
  username: string;
  discriminator: string;
  avatar?: string;
  bot: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  userId: string;
  guildId: string;
  nickname?: string;
  joinedAt: Date;
  xp: number;
  level: number;
  messages: number;
  voiceMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuildSettings {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannel?: string;
  welcomeMessage?: string;
  goodbyeEnabled: boolean;
  goodbyeChannel?: string;
  goodbyeMessage?: string;
  logsEnabled: boolean;
  logsChannel?: string;
  xpEnabled: boolean;
  xpRate: number;
  levelUpMessage?: string;
  levelUpChannel?: string;
  customCommands: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ModLogCategory = 'message' | 'member' | 'moderation' | 'wordFilter';

export interface ModLogSetting {
  id: number;
  guildId: string;
  category: ModLogCategory;
  channelId: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type WordFilterMatchType = 'literal' | 'regex';
export type WordFilterSeverity = 'low' | 'medium' | 'high' | 'critical';
export type WordFilterActionType = 'warn' | 'timeout' | 'kick' | 'ban' | 'delete' | 'note';

export interface WordFilterActionConfig {
  type: WordFilterActionType;
  durationSeconds?: number;
  reason?: string;
}

export interface WordFilterRule {
  id: number;
  guildId: string;
  pattern: string;
  matchType: WordFilterMatchType;
  caseSensitive: boolean;
  wholeWord: boolean;
  severity: WordFilterSeverity;
  autoDelete: boolean;
  notifyChannelId?: string;
  actions: WordFilterActionConfig[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModCase {
  id: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  type: ModActionType;
  reason?: string;
  duration?: number;
  expiresAt?: Date;
  createdAt: Date;
}

export enum ModActionType {
  Warn = 'warn',
  Mute = 'mute',
  Kick = 'kick',
  Ban = 'ban',
  Unmute = 'unmute',
  Unban = 'unban',
  Timeout = 'timeout',
  Lock = 'lock',
  Unlock = 'unlock',
  Slowmode = 'slowmode',
  Purge = 'purge',
}

export interface Giveaway {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  prize: string;
  description?: string;
  winnerCount: number;
  endTime: Date;
  ended: boolean;
  winners?: string[];
  participants: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  guildId: string;
  panelId?: string | null;
  departmentId?: string | null;
  ticketNumber: number;
  channelId: string;
  userId: string;
  category?: string;
  reason?: string | null;
  status: TicketStatus | string;
  claimedBy?: string | null;
  closedBy?: string | null;
  closedReason?: string | null;
  closedAt?: Date | null;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  frozenBy?: string | null;
  frozenAt?: Date | null;
  slaBreached: boolean;
  ratingId?: string | null;
  transcript?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum TicketStatus {
  Open = 'open',
  Claimed = 'claimed',
  Closed = 'closed',
  Locked = 'locked',
  Frozen = 'frozen',
}

export interface UserXp {
  userId: string;
  guildId: string;
  xp: number;
  level: number;
  prestigeLevel: number;
  lastXpGain: Date;
  lastVoiceActivity?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// AutoMod V2 Types
export interface AutoModRule {
  id: string;
  guildId: string;
  name: string;
  description?: string | null;
  eventType: string;
  triggerType: string;
  triggerMetadata: Record<string, any>;
  conditions: Record<string, any>;
  exemptRoles: string[];
  exemptChannels: string[];
  actions: Record<string, any>[];
  enabled: boolean;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoModInfraction {
  id: string;
  guildId: string;
  userId: string;
  ruleId?: string | null;
  points: number;
  actionTaken: string;
  reason?: string | null;
  active: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface QuarantineVault {
  id: string;
  guildId: string;
  userId: string;
  originalRoles: string[];
  reason?: string | null;
  jailedBy?: string | null;
  released: boolean;
  releasedBy?: string | null;
  releasedAt?: Date | null;
  createdAt: Date;
}

// Engagement & Achievement Types
export interface Achievement {
  id: string;
  guildId: string;
  achievementId: string;
  title: string;
  description: string;
  requirementType: string;
  requirementValue: number;
  rewardXp: number;
  rewardCoins: number;
  customIcon?: string | null;
  createdAt: Date;
}

export interface UserAchievement {
  id: string;
  guildId: string;
  userId: string;
  achievementId: string;
  unlockedAt: Date;
}

export interface EngagementQuest {
  id: string;
  guildId: string;
  questId: string;
  title: string;
  description: string;
  type: string;
  targetType: string;
  targetValue: number;
  rewardXp: number;
  rewardCoins: number;
  activeUntil: Date;
  createdAt: Date;
}

export interface UserQuestProgress {
  id: string;
  guildId: string;
  userId: string;
  questId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date | null;
  lastUpdated: Date;
}

export interface UserReputation {
  id: string;
  guildId: string;
  userId: string;
  senderId: string;
  reason?: string | null;
  createdAt: Date;
}

// Ticket Workflows Types
export interface TicketPanel {
  id: string;
  guildId: string;
  panelId: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  footer?: string | null;
  buttonLabel: string;
  buttonStyle: number;
  supportRoles: string[];
  categoryId?: string | null;
  ticketNameFormat: string;
  maxTicketsPerUser: number;
  welcomeMessage?: string | null;
  isActive: boolean;
  messageId?: string | null;
  channelId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketDepartment {
  id: string;
  guildId: string;
  panelId: string;
  departmentId: string;
  name: string;
  description: string;
  emoji?: string | null;
  categoryId?: string | null;
  supportRoles: string[];
  modalFields: Record<string, any>[];
  welcomeMessage?: string | null;
  slaTimeoutMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketRating {
  id: string;
  guildId: string;
  ticketId: string;
  userId: string;
  claimedBy?: string | null;
  rating: number;
  feedback?: string | null;
  createdAt: Date;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  attachments: Record<string, any>[];
  createdAt: Date;
}
