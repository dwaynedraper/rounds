// Rounds — Better Auth tables (Phase 2).
//
// Hand-modeled to Better Auth v1.6's core schema (the CLI's native deps
// won't build in this sandbox). Drizzle property names MUST equal Better
// Auth's field names (camelCase: emailVerified, userId, expiresAt, …) —
// the drizzle adapter matches on those keys. DB column names are snake_case.
// Verified empirically by running a full magic-link sign-in against a real
// Postgres (see docs/WORKLOG.md Phase 2). `role` is our additionalField.

import {
  pgTable, text, boolean, timestamp, integer, primaryKey,
} from "drizzle-orm/pg-core";
import { userRole, brands } from "./schema";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("editor"), // additionalField (S4)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Brand scoping (S4): editors may only touch rows whose brand is in here.
// Enforced in the data layer, never trusted from the client.
export const userBrands = pgTable(
  "user_brands",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    brandId: integer("brand_id").notNull().references(() => brands.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.brandId] })],
);
