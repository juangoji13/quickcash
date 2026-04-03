import { pgTable, uuid, varchar, integer, doublePrecision, timestamp, jsonb, text, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('COP').notNull(),
  non_working_days: jsonb('non_working_days').default(['sunday']).notNull(),
  holidays: jsonb('holidays').default([]).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 50 }).unique(), // Soporte para @handle
  email: varchar('email', { length: 255 }).unique().notNull(),
  password_hash: text('password_hash').notNull(),
  full_name: varchar('full_name', { length: 255 }),
  role: varchar('role', { length: 50 }).default('collector').notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  phone: varchar('phone', { length: 50 }),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('collector').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  invited_by: uuid('invited_by').references(() => users.id).notNull(),
  expires_at: timestamp('expires_at').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const collection_routes = pgTable('collection_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  zone: varchar('zone', { length: 255 }),
  collector_id: uuid('collector_id').references(() => users.id),
  color: varchar('color', { length: 50 }).default('#3B82F6'),
  is_active: boolean('is_active').default(true),
  notes: text('notes'),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const route_closures = pgTable('route_closures', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  collector_id: uuid('collector_id').references(() => users.id).notNull(),
  closure_date: timestamp('closure_date').defaultNow().notNull(),
  total_collected: doublePrecision('total_collected').default(0).notNull(),
  total_expected: doublePrecision('total_expected').default(0).notNull(),
  total_visits: integer('total_visits').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(), // open, closed
  created_at: timestamp('created_at').defaultNow().notNull(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  full_name: varchar('full_name', { length: 255 }).notNull(),
  document_id: varchar('document_id', { length: 50 }),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  risk_status: varchar('risk_status', { length: 20 }).default('green').notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  collector_id: uuid('collector_id').references(() => users.id),
  route_id: uuid('route_id').references(() => collection_routes.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  principal_amount: doublePrecision('principal_amount').notNull(),
  interest_rate: doublePrecision('interest_rate').default(20).notNull(),
  total_amount: doublePrecision('total_amount').notNull(),
  paid_installments: integer('paid_installments').default(0).notNull(),
  total_installments: integer('total_installments').notNull(),
  balance: doublePrecision('balance'),
  installment_amount: doublePrecision('installment_amount').notNull(),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  frequency: varchar('frequency', { length: 20 }).default('daily').notNull(),
  start_date: timestamp('start_date').defaultNow().notNull(),
  end_date: timestamp('end_date').notNull(),
  client_id: uuid('client_id').references(() => clients.id).notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  collector_id: uuid('collector_id').references(() => users.id).notNull(),
  skip_non_working_days: boolean('skip_non_working_days').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  loan_id: uuid('loan_id').references(() => loans.id).notNull(),
  installment_number: integer('installment_number').notNull(),
  amount_due: doublePrecision('amount_due').notNull(),
  amount_paid: doublePrecision('amount_paid').default(0).notNull(),
  due_date: timestamp('due_date').notNull(),
  paid_date: timestamp('paid_date'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  is_locked: boolean('is_locked').default(false).notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  collector_id: uuid('collector_id').references(() => users.id).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  loans: many(loans),
  invitations: many(invitations),
  collection_routes: many(collection_routes),
  route_closures: many(route_closures),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenant_id], references: [tenants.id] }),
  clients: many(clients),
  loans: many(loans),
  invitations_sent: many(invitations),
  collection_routes_managed: many(collection_routes),
  route_closures: many(route_closures),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  tenant: one(tenants, { fields: [invitations.tenant_id], references: [tenants.id] }),
  inviter: one(users, { fields: [invitations.invited_by], references: [users.id] }),
}));

export const routeClosuresRelations = relations(route_closures, ({ one }) => ({
  tenant: one(tenants, { fields: [route_closures.tenant_id], references: [tenants.id] }),
  collector: one(users, { fields: [route_closures.collector_id], references: [users.id] }),
}));

export const collectionRoutesRelations = relations(collection_routes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [collection_routes.tenant_id], references: [tenants.id] }),
  collector: one(users, { fields: [collection_routes.collector_id], references: [users.id] }),
  clients: many(clients),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, { fields: [clients.tenant_id], references: [tenants.id] }),
  collector: one(users, { fields: [clients.collector_id], references: [users.id] }),
  route: one(collection_routes, { fields: [clients.route_id], references: [collection_routes.id] }),
  loans: many(loans),
}));

export const loansRelations = relations(loans, ({ one, many }) => ({
  tenant: one(tenants, { fields: [loans.tenant_id], references: [tenants.id] }),
  client: one(clients, { fields: [loans.client_id], references: [clients.id] }),
  collector: one(users, { fields: [loans.collector_id], references: [users.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  loan: one(loans, { fields: [payments.loan_id], references: [loans.id] }),
  tenant: one(tenants, { fields: [payments.tenant_id], references: [tenants.id] }),
  collector: one(users, { fields: [payments.collector_id], references: [users.id] }),
}));
