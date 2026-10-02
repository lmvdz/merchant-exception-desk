import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const operations = sqliteTable('operations', {
 id: text('id').primaryKey(), session: text('session').notNull(), caseId: text('case_id').notNull(), mode: text('mode').notNull(),
 amount: integer('amount').notNull(), requestId: text('request_id').notNull().unique(), status: text('status').notNull(),
 captureId:text('capture_id').notNull(), providerPayload:text('provider_payload').notNull(),
 refundId: text('refund_id'), providerStatus: text('provider_status'), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(), attempts: integer('attempts').notNull().default(1),
});
export const audit = sqliteTable('audit', {id:text('id').primaryKey(), session:text('session').notNull(),caseId:text('case_id').notNull(),event:text('event').notNull(),detail:text('detail').notNull(),createdAt:text('created_at').notNull()});
