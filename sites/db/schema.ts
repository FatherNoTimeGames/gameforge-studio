import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  owner: text('owner').primaryKey(),
  revision: integer('revision').notNull(),
  blobKey: text('blob_key').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
export const requests = sqliteTable('requests', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  fingerprint: text('fingerprint').notNull(),
  state: text('state').notNull(),
  blobKey: text('blob_key').notNull(),
  resultKey: text('result_key'),
  createdAt: integer('created_at').notNull(),
}, (t) => [index('requests_owner_created').on(t.owner, t.createdAt), index('requests_owner_fingerprint').on(t.owner, t.fingerprint)]);
