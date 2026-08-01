import {
  pgTable,
  varchar,
  timestamp,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const bugReports = pgTable('bug_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id', { length: 20 })
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  command: varchar('command', { length: 100 }),
  title: varchar('title', { length: 256 }).notNull(),
  description: text('description').notNull(),
  stepsToReproduce: text('steps_to_reproduce'),
  status: varchar('status', { length: 20 }).default('open').notNull(), // open, in_progress, solved, closed
  assignee: varchar('assignee', { length: 256 }),
  developerNote: text('developer_note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
