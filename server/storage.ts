import {
  users,
  cloudFiles,
  copyOperations,
  type User,
  type UpsertUser,
  type CloudFile,
  type InsertCloudFile,
  type CopyOperation,
  type InsertCopyOperation,
} from "@shared/schema";
import { getDb } from "./db";
import { eq, desc, sql, and, or, isNull, lte, count, asc } from "drizzle-orm";

export interface IStorage {
  // User operations - mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
    membershipPlan?: string;
    membershipExpiry?: Date;
    membershipTrialUsed?: boolean;
  }): Promise<User>;
  updateUserGoogleTokens(userId: string, tokens: {
    accessToken: string | null;
    refreshToken?: string | null;
    expiry?: Date | null;
  }): Promise<User>;
  updateUserDropboxTokens(userId: string, tokens: {
    accessToken: string | null;
    refreshToken?: string | null;
    expiry?: Date | null;
  }): Promise<User>;
  
  // Stripe integration methods - for Stripe payment processing
  updateUserStripeInfo(userId: string, stripeData: {
    customerId?: string;
    subscriptionId?: string;
  }): Promise<User>;
  
  // Cloud files operations (Google Drive, Dropbox, etc.)
  createCloudFile(cloudFile: InsertCloudFile): Promise<CloudFile>;
  getUserCloudFiles(userId: string, page?: number, limit?: number): Promise<{ files: CloudFile[]; total: number; totalPages: number }>;
  
  // Copy operations
  createCopyOperation(operation: InsertCopyOperation): Promise<CopyOperation>;
  updateCopyOperation(id: string, updates: Partial<CopyOperation>): Promise<CopyOperation>;
  getCopyOperation(id: string): Promise<CopyOperation | undefined>;
  getUserCopyOperations(userId: string): Promise<CopyOperation[]>;
  getRecentCopyOperations(userId: string, limit: number): Promise<CopyOperation[]>;
  
  // Job queue operations
  claimPendingJobs(workerId: string, limit: number): Promise<CopyOperation[]>;
  setJobInProgress(id: string, workerId: string): Promise<CopyOperation>;
  setJobPendingWithBackoff(id: string, attempts: number, nextRunAt: Date, errorMessage?: string): Promise<CopyOperation>;
  completeJob(id: string, result: { copiedFileId?: string; copiedFileName?: string; copiedFileUrl?: string; duration?: number }): Promise<CopyOperation>;
  failJob(id: string, errorMessage: string): Promise<CopyOperation>;
  countUserRunningJobs(userId: string): Promise<number>;
  setJobProgress(id: string, completedFiles: number, totalFiles: number, progressPct: number): Promise<CopyOperation>;
  requestJobCancel(id: string): Promise<CopyOperation>;
  reclaimStaleJobs(staleDurationMs: number): Promise<number>;
  
  // Cleanup operations for old completed/failed jobs
  cleanupOldOperations(olderThanMs: number): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await getDb().select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await getDb()
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
    membershipPlan?: string;
    membershipExpiry?: Date;
    membershipTrialUsed?: boolean;
  }): Promise<User> {
    // Filter out undefined values to avoid overwriting existing data
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    const [user] = await getDb()
      .update(users)
      .set({
        ...cleanUpdates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserGoogleTokens(userId: string, tokens: {
    accessToken: string | null;
    refreshToken?: string | null;
    expiry?: Date | null;
  }): Promise<User> {
    const [user] = await getDb()
      .update(users)
      .set({
        googleAccessToken: tokens.accessToken,
        googleRefreshToken: tokens.refreshToken || null,
        googleTokenExpiry: tokens.expiry || null,
        googleConnected: tokens.accessToken ? true : false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserDropboxTokens(userId: string, tokens: {
    accessToken: string | null;
    refreshToken?: string | null;
    expiry?: Date | null;
  }): Promise<User> {
    const [user] = await getDb()
      .update(users)
      .set({
        dropboxAccessToken: tokens.accessToken,
        dropboxRefreshToken: tokens.refreshToken || null,
        dropboxTokenExpiry: tokens.expiry || null,
        dropboxConnected: !!(tokens.accessToken || tokens.refreshToken),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async createCloudFile(cloudFile: InsertCloudFile): Promise<CloudFile> {
    const [file] = await getDb()
      .insert(cloudFiles)
      .values(cloudFile)
      .returning();
    return file;
  }

  async getUserCloudFiles(
    userId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{ files: CloudFile[]; total: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    // Obtener archivos paginados
    const files = await getDb()
      .select()
      .from(cloudFiles)
      .where(eq(cloudFiles.userId, userId))
      .orderBy(desc(cloudFiles.createdAt))
      .limit(limit)
      .offset(offset);
    
    // Obtener total de archivos
    const [{ count }] = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(cloudFiles)
      .where(eq(cloudFiles.userId, userId));
    
    const total = Number(count);
    const totalPages = Math.ceil(total / limit);
    
    return { files, total, totalPages };
  }

  async createCopyOperation(operation: InsertCopyOperation): Promise<CopyOperation> {
    const [op] = await getDb()
      .insert(copyOperations)
      .values(operation)
      .returning();
    return op;
  }

  async updateCopyOperation(id: string, updates: Partial<CopyOperation>): Promise<CopyOperation> {
    const [op] = await getDb()
      .update(copyOperations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(copyOperations.id, id))
      .returning();
    return op;
  }

  async getCopyOperation(id: string): Promise<CopyOperation | undefined> {
    const [op] = await getDb()
      .select()
      .from(copyOperations)
      .where(eq(copyOperations.id, id));
    return op;
  }

  async getUserCopyOperations(userId: string): Promise<CopyOperation[]> {
    return await getDb()
      .select()
      .from(copyOperations)
      .where(eq(copyOperations.userId, userId))
      .orderBy(desc(copyOperations.createdAt));
  }

  async getRecentCopyOperations(userId: string, limit: number): Promise<CopyOperation[]> {
    return await getDb()
      .select()
      .from(copyOperations)
      .where(eq(copyOperations.userId, userId))
      .orderBy(desc(copyOperations.createdAt))
      .limit(limit);
  }

  // Job queue operations implementation  
  async claimPendingJobs(workerId: string, limit: number): Promise<CopyOperation[]> {
    // Atomic job claiming with proper limit and ordering using CTE
    const claimedJobs = await getDb().execute(sql`
      WITH cte AS (
        SELECT id FROM copy_operations 
        WHERE status = 'pending' 
        AND (next_run_at IS NULL OR next_run_at <= NOW())
        ORDER BY priority DESC, created_at ASC 
        FOR UPDATE SKIP LOCKED 
        LIMIT ${limit}
      )
      UPDATE copy_operations 
      SET 
        status = 'in_progress',
        locked_by = ${workerId},
        locked_at = NOW(),
        updated_at = NOW()
      FROM cte 
      WHERE copy_operations.id = cte.id 
      RETURNING copy_operations.*
    `);

    // Map raw results to proper CopyOperation objects
    return claimedJobs.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      sourceUrl: row.source_url,
      destinationFolderId: row.destination_folder_id,
      status: row.status,
      totalFiles: row.total_files,
      completedFiles: row.completed_files,
      errorMessage: row.error_message,
      sourceProvider: row.source_provider,
      destProvider: row.dest_provider,
      sourceFileId: row.source_file_id,
      sourceFilePath: row.source_file_path,
      fileName: row.file_name,
      itemType: row.item_type,
      priority: row.priority,
      attempts: row.attempts,
      maxRetries: row.max_retries,
      nextRunAt: row.next_run_at,
      lockedBy: row.locked_by,
      lockedAt: row.locked_at,
      cancelRequested: row.cancel_requested,
      progressPct: row.progress_pct,
      copiedFileId: row.copied_file_id,
      copiedFileName: row.copied_file_name,
      copiedFileUrl: row.copied_file_url,
      duration: row.duration,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })) as CopyOperation[];
  }

  async setJobInProgress(id: string, workerId: string): Promise<CopyOperation> {
    const [job] = await getDb()
      .update(copyOperations)
      .set({
        status: 'in_progress',
        lockedBy: workerId,
        lockedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(copyOperations.id, id))
      .returning();
    return job;
  }

  async setJobPendingWithBackoff(id: string, attempts: number, nextRunAt: Date, errorMessage?: string): Promise<CopyOperation> {
    const [job] = await getDb()
      .update(copyOperations)
      .set({
        status: 'pending',
        attempts,
        nextRunAt,
        errorMessage,
        lockedBy: null,
        lockedAt: null,
        updatedAt: new Date()
      })
      .where(eq(copyOperations.id, id))
      .returning();
    return job;
  }

  async completeJob(id: string, result: { copiedFileId?: string; copiedFileName?: string; copiedFileUrl?: string; duration?: number }): Promise<CopyOperation> {
    const [job] = await getDb()
      .update(copyOperations)
      .set({
        status: 'completed',
        copiedFileId: result.copiedFileId,
        copiedFileName: result.copiedFileName,
        copiedFileUrl: result.copiedFileUrl,
        duration: result.duration,
        progressPct: 100,
        lockedBy: null,
        lockedAt: null,
        updatedAt: new Date()
      })
      .where(eq(copyOperations.id, id))
      .returning();
    return job;
  }

  async failJob(id: string, errorMessage: string): Promise<CopyOperation> {
    const [job] = await getDb()
      .update(copyOperations)
      .set({
        status: 'failed',
        errorMessage,
        lockedBy: null,
        lockedAt: null,
        updatedAt: new Date()
      })
      .where(eq(copyOperations.id, id))
      .returning();
    return job;
  }

  async countUserRunningJobs(userId: string): Promise<number> {
    const [result] = await getDb()
      .select({ count: count() })
      .from(copyOperations)
      .where(
        and(
          eq(copyOperations.userId, userId),
          eq(copyOperations.status, 'in_progress')
        )
      );
    return result.count;
  }

  async setJobProgress(id: string, completedFiles: number, totalFiles: number, progressPct: number): Promise<CopyOperation> {
    const [job] = await getDb()
      .update(copyOperations)
      .set({
        completedFiles,
        totalFiles,
        progressPct,
        updatedAt: new Date()
      })
      .where(eq(copyOperations.id, id))
      .returning();
    return job;
  }

  async requestJobCancel(id: string): Promise<CopyOperation> {
    const [job] = await getDb()
      .update(copyOperations)
      .set({
        cancelRequested: true,
        updatedAt: new Date()
      })
      .where(eq(copyOperations.id, id))
      .returning();
    return job;
  }

  async reclaimStaleJobs(staleDurationMs: number): Promise<number> {
    const staleThreshold = new Date(Date.now() - staleDurationMs);
    
    const reclaimedJobs = await getDb()
      .update(copyOperations)
      .set({
        status: 'pending',
        lockedBy: null,
        lockedAt: null,
        nextRunAt: new Date(), // Retry immediately
        updatedAt: new Date()
      })
      .where(
        and(
          eq(copyOperations.status, 'in_progress'),
          lte(copyOperations.lockedAt, staleThreshold)
        )
      )
      .returning();

    return reclaimedJobs.length;
  }

  async cleanupOldOperations(olderThanMs: number): Promise<number> {
    const cleanupThreshold = new Date(Date.now() - olderThanMs);
    
    const deletedOps = await getDb()
      .delete(copyOperations)
      .where(
        and(
          or(
            eq(copyOperations.status, 'completed'),
            eq(copyOperations.status, 'failed'),
            eq(copyOperations.status, 'cancelled')
          ),
          lte(copyOperations.updatedAt, cleanupThreshold)
        )
      )
      .returning();

    return deletedOps.length;
  }
}

// Memory storage for development when DATABASE_URL is not available
class MemoryStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private cloudFiles: Map<string, CloudFile> = new Map();
  private copyOperations: Map<string, CopyOperation> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.users.get(userData.id);
    const user: User = {
      ...existingUser,
      ...userData,
      createdAt: existingUser?.createdAt || new Date(),
      updatedAt: new Date(),
      googleAccessToken: existingUser?.googleAccessToken || null,
      googleRefreshToken: existingUser?.googleRefreshToken || null,
      googleTokenExpiry: existingUser?.googleTokenExpiry || null,
      googleConnected: existingUser?.googleConnected || false,
      dropboxAccessToken: existingUser?.dropboxAccessToken || null,
      dropboxRefreshToken: existingUser?.dropboxRefreshToken || null,
      dropboxTokenExpiry: existingUser?.dropboxTokenExpiry || null,
      dropboxConnected: existingUser?.dropboxConnected || false,
    };
    this.users.set(userData.id, user);
    return user;
  }

  async updateUser(userId: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
    profileImageUrl?: string;
    membershipPlan?: string;
    membershipExpiry?: Date;
    membershipTrialUsed?: boolean;
  }): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }
    
    // Filter out undefined values to avoid overwriting existing data
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );
    
    const user: User = {
      ...existingUser,
      ...cleanUpdates,
      updatedAt: new Date(),
    };
    this.users.set(userId, user);
    return user;
  }

  async updateUserGoogleTokens(userId: string, tokens: {
    accessToken: string | null;
    refreshToken?: string | null;
    expiry?: Date | null;
  }): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }
    
    const user: User = {
      ...existingUser,
      googleAccessToken: tokens.accessToken,
      googleRefreshToken: tokens.refreshToken || null,
      googleTokenExpiry: tokens.expiry || null,
      googleConnected: tokens.accessToken ? true : false,
      updatedAt: new Date(),
    };
    this.users.set(userId, user);
    return user;
  }

  async updateUserDropboxTokens(userId: string, tokens: {
    accessToken: string | null;
    refreshToken?: string | null;
    expiry?: Date | null;
  }): Promise<User> {
    const existingUser = this.users.get(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }
    
    const user: User = {
      ...existingUser,
      dropboxAccessToken: tokens.accessToken,
      dropboxRefreshToken: tokens.refreshToken || null,
      dropboxTokenExpiry: tokens.expiry || null,
      dropboxConnected: !!(tokens.accessToken || tokens.refreshToken),
      updatedAt: new Date(),
    };
    this.users.set(userId, user);
    return user;
  }

  async createCloudFile(cloudFile: InsertCloudFile): Promise<CloudFile> {
    const file: CloudFile = {
      ...cloudFile,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
    };
    this.cloudFiles.set(file.id, file);
    return file;
  }

  async getUserCloudFiles(
    userId: string, 
    page: number = 1, 
    limit: number = 10
  ): Promise<{ files: CloudFile[]; total: number; totalPages: number }> {
    const userFiles = Array.from(this.cloudFiles.values())
      .filter(file => file.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    const total = userFiles.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const files = userFiles.slice(offset, offset + limit);
    
    return { files, total, totalPages };
  }

  async createCopyOperation(operation: InsertCopyOperation): Promise<CopyOperation> {
    const op: CopyOperation = {
      ...operation,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.copyOperations.set(op.id, op);
    return op;
  }

  async updateCopyOperation(id: string, updates: Partial<CopyOperation>): Promise<CopyOperation> {
    const existingOp = this.copyOperations.get(id);
    if (!existingOp) {
      throw new Error('Copy operation not found');
    }
    
    const op: CopyOperation = {
      ...existingOp,
      ...updates,
      updatedAt: new Date(),
    };
    this.copyOperations.set(id, op);
    return op;
  }

  async getCopyOperation(id: string): Promise<CopyOperation | undefined> {
    return this.copyOperations.get(id);
  }

  async getUserCopyOperations(userId: string): Promise<CopyOperation[]> {
    return Array.from(this.copyOperations.values())
      .filter(op => op.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getRecentCopyOperations(userId: string, limit: number): Promise<CopyOperation[]> {
    return Array.from(this.copyOperations.values())
      .filter(op => op.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Job queue operations implementation for memory storage
  async claimPendingJobs(workerId: string, limit: number): Promise<CopyOperation[]> {
    const now = new Date();
    const readyJobs = Array.from(this.copyOperations.values())
      .filter(op => 
        op.status === 'pending' && 
        (!op.nextRunAt || op.nextRunAt <= now)
      )
      .sort((a, b) => {
        // Sort by priority desc, then by createdAt asc
        if (a.priority !== b.priority) {
          return (b.priority || 0) - (a.priority || 0);
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, limit);

    // Atomically mark them as in progress
    const claimedJobs: CopyOperation[] = [];
    for (const job of readyJobs) {
      // Double-check the job is still pending (for consistency with DB implementation)
      const currentJob = this.copyOperations.get(job.id);
      if (currentJob && currentJob.status === 'pending') {
        const updated: CopyOperation = {
          ...currentJob,
          status: 'in_progress',
          lockedBy: workerId,
          lockedAt: now,
          updatedAt: now
        };
        this.copyOperations.set(job.id, updated);
        claimedJobs.push(updated);
      }
    }

    return claimedJobs;
  }

  async setJobInProgress(id: string, workerId: string): Promise<CopyOperation> {
    const job = this.copyOperations.get(id);
    if (!job) {
      throw new Error('Job not found');
    }

    const updated: CopyOperation = {
      ...job,
      status: 'in_progress',
      lockedBy: workerId,
      lockedAt: new Date(),
      updatedAt: new Date()
    };
    this.copyOperations.set(id, updated);
    return updated;
  }

  async setJobPendingWithBackoff(id: string, attempts: number, nextRunAt: Date, errorMessage?: string): Promise<CopyOperation> {
    const job = this.copyOperations.get(id);
    if (!job) {
      throw new Error('Job not found');
    }

    const updated: CopyOperation = {
      ...job,
      status: 'pending',
      attempts,
      nextRunAt,
      errorMessage: errorMessage || null,
      lockedBy: null,
      lockedAt: null,
      updatedAt: new Date()
    };
    this.copyOperations.set(id, updated);
    return updated;
  }

  async completeJob(id: string, result: { copiedFileId?: string; copiedFileName?: string; copiedFileUrl?: string; duration?: number }): Promise<CopyOperation> {
    const job = this.copyOperations.get(id);
    if (!job) {
      throw new Error('Job not found');
    }

    const updated: CopyOperation = {
      ...job,
      status: 'completed',
      copiedFileId: result.copiedFileId || null,
      copiedFileName: result.copiedFileName || null,
      copiedFileUrl: result.copiedFileUrl || null,
      duration: result.duration || null,
      progressPct: 100,
      lockedBy: null,
      lockedAt: null,
      updatedAt: new Date()
    };
    this.copyOperations.set(id, updated);
    return updated;
  }

  async failJob(id: string, errorMessage: string): Promise<CopyOperation> {
    const job = this.copyOperations.get(id);
    if (!job) {
      throw new Error('Job not found');
    }

    const updated: CopyOperation = {
      ...job,
      status: 'failed',
      errorMessage,
      lockedBy: null,
      lockedAt: null,
      updatedAt: new Date()
    };
    this.copyOperations.set(id, updated);
    return updated;
  }

  async countUserRunningJobs(userId: string): Promise<number> {
    return Array.from(this.copyOperations.values())
      .filter(op => op.userId === userId && op.status === 'in_progress')
      .length;
  }

  async setJobProgress(id: string, completedFiles: number, totalFiles: number, progressPct: number): Promise<CopyOperation> {
    const job = this.copyOperations.get(id);
    if (!job) {
      throw new Error('Job not found');
    }

    const updated: CopyOperation = {
      ...job,
      completedFiles,
      totalFiles,
      progressPct,
      updatedAt: new Date()
    };
    this.copyOperations.set(id, updated);
    return updated;
  }

  async requestJobCancel(id: string): Promise<CopyOperation> {
    const job = this.copyOperations.get(id);
    if (!job) {
      throw new Error('Job not found');
    }

    const updated: CopyOperation = {
      ...job,
      cancelRequested: true,
      updatedAt: new Date()
    };
    this.copyOperations.set(id, updated);
    return updated;
  }

  async reclaimStaleJobs(staleDurationMs: number): Promise<number> {
    const staleThreshold = new Date(Date.now() - staleDurationMs);
    let reclaimedCount = 0;

    for (const [id, job] of this.copyOperations.entries()) {
      if (job.status === 'in_progress' && 
          job.lockedAt && 
          job.lockedAt <= staleThreshold) {
        
        const updated: CopyOperation = {
          ...job,
          status: 'pending',
          lockedBy: null,
          lockedAt: null,
          nextRunAt: new Date(), // Retry immediately
          updatedAt: new Date()
        };
        this.copyOperations.set(id, updated);
        reclaimedCount++;
      }
    }

    return reclaimedCount;
  }

  async cleanupOldOperations(olderThanMs: number): Promise<number> {
    const cleanupThreshold = new Date(Date.now() - olderThanMs);
    let deletedCount = 0;

    for (const [id, job] of this.copyOperations.entries()) {
      if ((job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
          job.updatedAt && job.updatedAt <= cleanupThreshold) {
        this.copyOperations.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}

// Use memory storage for development, database storage for production
export const storage = (process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL) 
  ? new MemoryStorage() 
  : new DatabaseStorage();
