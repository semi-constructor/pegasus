import {
  pgTable,
  varchar,
  timestamp,
  text,
  uuid,
  boolean,
  jsonb,
  integer,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';
import { ticketDepartments, ticketRatings } from './ticket_workflows';

export const ticketPanels = pgTable('ticket_panels', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  panelId: varchar('panel_id', { length: 20 }).notNull().unique(), // Custom ID for easy reference
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description').notNull(),
  imageUrl: varchar('image_url', { length: 512 }),
  footer: varchar('footer', { length: 256 }),
  buttonLabel: varchar('button_label', { length: 80 }).default('Create Ticket').notNull(),
  buttonStyle: integer('button_style').default(1).notNull(), // Discord button style
  supportRoles: jsonb('support_roles').default('[]').notNull(), // Array of role IDs
  categoryId: varchar('category_id', { length: 20 }), // Discord category ID for tickets
  ticketNameFormat: varchar('ticket_name_format', { length: 100 })
    .default('ticket-{number}')
    .notNull(),
  maxTicketsPerUser: integer('max_tickets_per_user').default(1).notNull(),
  welcomeMessage: text('welcome_message'),
  isActive: boolean('is_active').default(true).notNull(),
  messageId: varchar('message_id', { length: 20 }), // If panel is posted
  channelId: varchar('channel_id', { length: 20 }), // Where panel is posted
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tickets = pgTable('tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: varchar('guild_id', { length: 20 })
    .references(() => guilds.id, { onDelete: 'cascade' })
    .notNull(),
  panelId: uuid('panel_id').references(() => ticketPanels.id, { onDelete: 'set null' }),
  departmentId: uuid('department_id').references(() => ticketDepartments.id, {
    onDelete: 'set null',
  }),
  ticketNumber: integer('ticket_number').notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  userId: varchar('user_id', { length: 20 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  reason: text('reason'), // Initial reason from modal
  status: varchar('status', { length: 20 }).default('open').notNull(), // open, claimed, closed, locked, frozen
  claimedBy: varchar('claimed_by', { length: 20 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  closedBy: varchar('closed_by', { length: 20 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  closedReason: text('closed_reason'),
  closedAt: timestamp('closed_at'),
  lockedBy: varchar('locked_by', { length: 20 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  lockedAt: timestamp('locked_at'),
  frozenBy: varchar('frozen_by', { length: 20 }).references(() => users.id, {
    onDelete: 'set null',
  }),
  frozenAt: timestamp('frozen_at'),
  slaBreached: boolean('sla_breached').default(false).notNull(),
  ratingId: uuid('rating_id').references((): AnyPgColumn => ticketRatings.id, {
    onDelete: 'set null',
  }),
  transcript: text('transcript'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticketId: uuid('ticket_id')
    .references(() => tickets.id, { onDelete: 'cascade' })
    .notNull(),
  userId: varchar('user_id', { length: 20 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  attachments: jsonb('attachments').default('[]').notNull(), // JSON array of attachment objects
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
