import { z } from 'zod';

export const achievementSchema = z.object({
  guildId: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(1000),
  requirementType: z.string(),
  requirementValue: z.number().positive(),
  rewardXp: z.number().nonnegative().default(0),
  rewardCoins: z.number().nonnegative().default(0),
  roleRewardId: z.string().optional(),
});

export const questSchema = z.object({
  guildId: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(1000),
  questType: z.enum(['daily', 'weekly', 'monthly', 'special']),
  targetType: z.string(),
  targetValue: z.number().positive(),
  rewardXp: z.number().nonnegative().default(0),
  rewardCoins: z.number().nonnegative().default(0),
  expiresAt: z.date().optional(),
});

export const reputationSchema = z.object({
  guildId: z.string(),
  userId: z.string(),
  senderId: z.string(),
  reason: z.string().optional(),
});
