import { z } from 'zod';

export const ticketDepartmentSchema = z.object({
  guildId: z.string(),
  panelId: z.string(),
  departmentId: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(1024),
  categoryId: z.string().optional(),
  supportRoles: z.array(z.string()).default([]),
  modalFields: z.array(z.record(z.unknown())).optional(),
  welcomeMessage: z.string().max(2048).optional(),
  slaTimeoutMinutes: z.number().positive().optional(),
  emoji: z.string().optional(),
});

export const ticketRatingSchema = z.object({
  guildId: z.string(),
  ticketId: z.string(),
  userId: z.string(),
  claimedBy: z.string().optional(),
  rating: z.number().min(1).max(5),
  feedback: z.string().max(2048).optional(),
});
