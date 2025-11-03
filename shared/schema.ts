import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - compatible with both Replit Auth and Supabase Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Authentication provider - 'replit' or 'supabase'
  authProvider: varchar("auth_provider").notNull().default('replit'),
  // User role - 'admin' or 'user'
  role: varchar("role").notNull().default('user'),
  // User limits
  maxStorageBytes: integer("max_storage_bytes").default(16106127360), // 15 GB default
  maxConcurrentOperations: integer("max_concurrent_operations").default(5),
  maxDailyOperations: integer("max_daily_operations").default(100),
  isActive: boolean("is_active").default(true),
  // Google OAuth fields
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiry: timestamp("google_token_expiry"),
  googleConnected: boolean("google_connected").default(false),
  // Dropbox OAuth fields
  dropboxAccessToken: text("dropbox_access_token"),
  dropboxRefreshToken: text("dropbox_refresh_token"),
  dropboxTokenExpiry: timestamp("dropbox_token_expiry"),
  dropboxConnected: boolean("dropbox_connected").default(false),
  // Membership fields
  membershipPlan: varchar("membership_plan").notNull().default('free'), // 'free', 'pro'
  membershipExpiry: timestamp("membership_expiry"),
  membershipTrialUsed: boolean("membership_trial_used").default(false),
  // Stripe integration fields - for Stripe payment processing
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
});

// Cloud files table for tracking copied files from all providers (Google Drive, Dropbox, etc.)
export const cloudFiles = pgTable("cloud_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: varchar("provider").notNull(), // 'google' | 'dropbox' | 'onedrive' etc.
  originalFileId: varchar("original_file_id").notNull(),
  copiedFileId: varchar("copied_file_id").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: varchar("mime_type"),
  fileSize: integer("file_size"),
  sourceUrl: text("source_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Copy operations for tracking progress and job queue
export const copyOperations = pgTable("copy_operations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sourceUrl: text("source_url").notNull(),
  destinationFolderId: text("destination_folder_id").notNull().default('root'), // Google Drive folder ID
  status: varchar("status").notNull(), // 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  totalFiles: integer("total_files").default(0),
  completedFiles: integer("completed_files").default(0),
  errorMessage: text("error_message"),
  
  // Queue system fields
  sourceProvider: varchar("source_provider"), // 'google' | 'dropbox'
  destProvider: varchar("dest_provider"), // 'google' | 'dropbox'
  sourceFileId: varchar("source_file_id"), // For Google Drive
  sourceFilePath: text("source_file_path"), // For Dropbox
  fileName: text("file_name"), // Original file name
  itemType: varchar("item_type").default('file'), // 'file' | 'folder'
  priority: integer("priority").default(0),
  attempts: integer("attempts").default(0),
  maxRetries: integer("max_retries").default(5),
  nextRunAt: timestamp("next_run_at"),
  lockedBy: varchar("locked_by"), // Instance/worker ID
  lockedAt: timestamp("locked_at"),
  cancelRequested: boolean("cancel_requested").default(false),
  progressPct: integer("progress_pct").default(0),
  
  // Result fields
  copiedFileId: varchar("copied_file_id"), // ID del archivo/carpeta copiado
  copiedFileName: text("copied_file_name"), // Nombre del archivo/carpeta copiado
  copiedFileUrl: text("copied_file_url"), // Enlace directo al archivo/carpeta copiado
  duration: integer("duration"), // Duración en segundos
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertCloudFile = typeof cloudFiles.$inferInsert;
export type CloudFile = typeof cloudFiles.$inferSelect;

export type InsertCopyOperation = typeof copyOperations.$inferInsert;
export type CopyOperation = typeof copyOperations.$inferSelect;

export const insertCloudFileSchema = createInsertSchema(cloudFiles).omit({
  id: true,
  createdAt: true,
});

export const insertCopyOperationSchema = createInsertSchema(copyOperations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
