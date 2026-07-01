import {
  pgTable,
  varchar,
  timestamp,
  text,
  uuid,
  jsonb,
  integer,
  index,
  AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';
import { ticketPanels, tickets } from './tickets';

export const ticketDepartments = pgTable(
  'ticket_departments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    panelId: uuid('panel_id')
      .references(() => ticketPanels.id, { onDelete: 'cascade' })
      .notNull(),
    departmentId: varchar('department_id', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    emoji: varchar('emoji', { length: 50 }),
    categoryId: varchar('category_id', { length: 20 }),
    supportRoles: jsonb('support_roles').default('[]').notNull(),
    modalFields: jsonb('modal_fields').default('[]').notNull(),
    welcomeMessage: text('welcome_message'),
    slaTimeoutMinutes: integer('sla_timeout_minutes').default(60).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    panelDeptIdx: index('ticket_departments_panel_idx').on(table.panelId),
  })
);

export const ticketRatings = pgTable(
  'ticket_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    guildId: varchar('guild_id', { length: 20 })
      .references(() => guilds.id, { onDelete: 'cascade' })
      .notNull(),
    ticketId: uuid('ticket_id')
      .references((): AnyPgColumn => tickets.id, { onDelete: 'cascade' })
      .notNull(),
    userId: varchar('user_id', { length: 20 })
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    claimedBy: varchar('claimed_by', { length: 20 }).references(() => users.id, {
      onDelete: 'set null',
    }),
    rating: integer('rating').notNull(),
    feedback: text('feedback'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => ({
    guildStaffIdx: index('ticket_ratings_guild_staff_idx').on(table.guildId, table.claimedBy),
    ticketIdx: index('ticket_ratings_ticket_idx').on(table.ticketId),
  })
);
