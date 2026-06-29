import { z } from 'zod';

export const autoModRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  eventType: z.string(),
  triggerType: z.enum(['KEYWORD', 'REGEX', 'MENTION_SPAM', 'ATTACHMENT_SPAM']),
  triggerMetadata: z.record(z.unknown()).optional(),
  actions: z.array(
    z.object({
      type: z.enum(['DELETE_MESSAGE', 'WARN_USER', 'TIMEOUT_USER', 'ADD_INFRACTION']),
      metadata: z.record(z.unknown()).optional(),
    })
  ).min(1),
  enabled: z.boolean().default(true),
  exemptRoles: z.array(z.string()).optional(),
  exemptChannels: z.array(z.string()).optional(),
});

export const infractionSchema = z.object({
  guildId: z.string(),
  userId: z.string(),
  ruleId: z.string(),
  points: z.number().int().positive(),
  actionTaken: z.string(),
  reason: z.string().optional(),
  expiresAt: z.date(),
});

export const quarantineVaultSchema = z.object({
  guildId: z.string(),
  userId: z.string(),
  originalRoles: z.array(z.string()),
  reason: z.string(),
  jailedBy: z.string().optional(),
});
