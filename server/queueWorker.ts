import { EventEmitter } from 'events';
import { storage } from './storage';
import { GoogleDriveService } from './services/googleDriveService';
import { DropboxService } from './services/dropboxService';
import type { CopyOperation } from '@shared/schema';

interface WorkerConfig {
  globalConcurrency: number;
  pollInterval: number;
  workerId: string;
  maxPollInterval: number;
  backoffMultiplier: number;
  connectionTimeout: number;
  heartbeatInterval: number;
}

interface UserConcurrencyLimits {
  free: number;
  pro: number;
}

export class QueueWorker extends EventEmitter {
  private config: WorkerConfig;
  private isRunning = false;
  private processingJobs = new Set<string>();
  private userLimits: UserConcurrencyLimits = {
    free: 1,
    pro: 3
  };
  private currentPollInterval: number;
  private consecutiveEmptyPolls = 0;
  private lastHeartbeat = Date.now();
  private servicePool = new Map<string, GoogleDriveService | DropboxService>();

  constructor(config: Partial<WorkerConfig> = {}) {
    super();
    this.config = {
      globalConcurrency: config.globalConcurrency || 5,
      pollInterval: config.pollInterval || 2000, // 2 seconds
      workerId: config.workerId || `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      maxPollInterval: config.maxPollInterval || 30000, // 30 seconds max
      backoffMultiplier: config.backoffMultiplier || 1.5,
      connectionTimeout: config.connectionTimeout || 60000, // 60 seconds
      heartbeatInterval: config.heartbeatInterval || 30000 // 30 seconds
    };
    this.currentPollInterval = this.config.pollInterval;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Queue worker is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Queue worker started with ID: ${this.config.workerId}`);
    console.log(`📊 Config: Global concurrency: ${this.config.globalConcurrency}, Poll interval: ${this.config.pollInterval}ms`);

    // Reclaim any stale jobs from previous worker instances
    try {
      const reclaimedCount = await storage.reclaimStaleJobs(300000); // 5 minutes
      if (reclaimedCount > 0) {
        console.log(`🔄 Reclaimed ${reclaimedCount} stale jobs from previous worker instances`);
      }
    } catch (error) {
      console.error('❌ Failed to reclaim stale jobs:', error);
    }

    this.processLoop();
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping queue worker...');
    this.isRunning = false;
    
    // Wait for current jobs to finish
    while (this.processingJobs.size > 0) {
      console.log(`⏳ Waiting for ${this.processingJobs.size} jobs to finish...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ Queue worker stopped');
  }

  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const jobsProcessed = await this.processPendingJobs();
        
        // Adaptive polling: reduce frequency when no work is available
        if (jobsProcessed === 0) {
          this.consecutiveEmptyPolls++;
          this.currentPollInterval = Math.min(
            this.currentPollInterval * this.config.backoffMultiplier,
            this.config.maxPollInterval
          );
        } else {
          // Reset to normal polling when work is found
          this.consecutiveEmptyPolls = 0;
          this.currentPollInterval = this.config.pollInterval;
        }

        // Periodic heartbeat and cleanup
        if (Date.now() - this.lastHeartbeat > this.config.heartbeatInterval) {
          await this.performHeartbeat();
          this.lastHeartbeat = Date.now();
        }

      } catch (error) {
        console.error('❌ Error in process loop:', error);
        // Reset to normal polling on error
        this.currentPollInterval = this.config.pollInterval;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.currentPollInterval));
    }
  }

  private async processPendingJobs(): Promise<number> {
    // Check how many slots we have available
    const availableSlots = this.config.globalConcurrency - this.processingJobs.size;
    if (availableSlots <= 0) {
      return 0;
    }

    // Periodically reclaim stale jobs (every ~30 poll cycles)
    if (Math.random() < 0.033) { // ~3.3% chance per poll
      try {
        const reclaimedCount = await storage.reclaimStaleJobs(300000); // 5 minutes
        if (reclaimedCount > 0) {
          console.log(`🔄 Reclaimed ${reclaimedCount} stale jobs`);
        }
      } catch (error) {
        console.error('❌ Failed to reclaim stale jobs:', error);
      }
    }

    // Claim pending jobs (reduced to avoid immediate user limit conflicts)
    const conservativeLimit = Math.min(availableSlots, 3);
    const jobs = await storage.claimPendingJobs(this.config.workerId, conservativeLimit);
    
    if (jobs.length === 0) {
      return 0;
    }

    console.log(`📋 Claimed ${jobs.length} jobs for processing`);

    let jobsStarted = 0;
    // Process each job with user concurrency validation
    for (const job of jobs) {
      if (this.processingJobs.size >= this.config.globalConcurrency) {
        break;
      }

      // Check user concurrency limits AFTER claiming to reduce churn
      const userRunningCount = await storage.countUserRunningJobs(job.userId);
      const user = await storage.getUser(job.userId);
      const userPlan = user?.membershipPlan || 'free';
      const userLimit = this.userLimits[userPlan as keyof UserConcurrencyLimits] || this.userLimits.free;

      if (userRunningCount >= userLimit) {
        // User has reached their limit, put job back with short delay
        console.log(`⏸️ User ${job.userId} (${userPlan}) has reached concurrency limit (${userRunningCount}/${userLimit})`);
        const nextRunAt = new Date(Date.now() + 5000); // 5 seconds delay
        await storage.setJobPendingWithBackoff(job.id, job.attempts || 0, nextRunAt, 'User concurrency limit reached');
        continue;
      }

      // Process job in background
      this.processJob(job).catch(error => {
        console.error(`❌ Unhandled error processing job ${job.id}:`, error);
      });
      jobsStarted++;
    }

    return jobsStarted;
  }

  private async processJob(job: CopyOperation): Promise<void> {
    const startTime = Date.now();
    this.processingJobs.add(job.id);
    
    console.log(`🔄 Processing job ${job.id}: ${job.fileName} (${job.sourceProvider} -> ${job.destProvider})`);

    try {
      // Check if job was cancelled
      const currentJob = await storage.getCopyOperation(job.id);
      if (currentJob?.cancelRequested) {
        await storage.failJob(job.id, 'Job was cancelled by user');
        this.emit('jobCancelled', job.id, job.userId);
        return;
      }

      // Update progress to show job started
      await storage.setJobProgress(job.id, 0, 1, 0);
      this.emit('jobProgress', job.id, job.userId, { completedFiles: 0, totalFiles: 1, progressPct: 0 });

      // Process the file transfer with timeout
      const result = await this.executeTransferWithTimeout(job);

      // Calculate duration
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Mark job as completed
      await storage.completeJob(job.id, {
        ...result,
        duration
      });

      console.log(`✅ Job ${job.id} completed successfully in ${duration}s`);
      this.emit('jobCompleted', job.id, job.userId, result);

    } catch (error) {
      console.error(`❌ Job ${job.id} failed:`, error);
      
      const attempts = (job.attempts || 0) + 1;
      const maxRetries = job.maxRetries || 5;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (attempts >= maxRetries || this.isNonRetryableError(error)) {
        // Max retries reached or non-retryable error
        await storage.failJob(job.id, errorMessage);
        this.emit('jobFailed', job.id, job.userId, errorMessage);
      } else {
        // Retry with exponential backoff
        const delay = this.calculateBackoffDelay(attempts);
        const nextRunAt = new Date(Date.now() + delay);
        
        await storage.setJobPendingWithBackoff(job.id, attempts, nextRunAt, errorMessage);
        console.log(`🔄 Job ${job.id} will retry in ${Math.round(delay / 1000)}s (attempt ${attempts}/${maxRetries})`);
        this.emit('jobRetry', job.id, job.userId, { attempts, nextRunAt, error: errorMessage });
      }
    } finally {
      this.processingJobs.delete(job.id);
    }
  }

  private async executeTransfer(job: CopyOperation): Promise<{ copiedFileId?: string; copiedFileName?: string; copiedFileUrl?: string }> {
    const { sourceProvider, destProvider, sourceFileId, sourceFilePath, fileName, destinationFolderId, sourceUrl } = job;

    // Check for cancellation before starting
    const currentJob = await storage.getCopyOperation(job.id);
    if (currentJob?.cancelRequested) {
      throw new Error('Job was cancelled by user');
    }

    // Detect if this is a folder operation by parsing the source URL
    let isFolder = false;
    if (sourceProvider === 'google' && sourceUrl) {
      try {
        const driveService = this.getServiceFromPool('google', job.userId) as GoogleDriveService;
        const { type } = driveService.parseGoogleDriveUrl(sourceUrl);
        isFolder = type === 'folder';
      } catch (error) {
        console.warn('Could not parse Google Drive URL, assuming file:', error);
      }
    } else if (sourceProvider === 'dropbox' && sourceUrl) {
      try {
        const dropboxService = this.getServiceFromPool('dropbox', job.userId) as DropboxService;
        const { type } = dropboxService.parseDropboxUrl(sourceUrl);
        isFolder = type === 'folder';
      } catch (error) {
        console.warn('Could not parse Dropbox URL, assuming file:', error);
      }
    }

    // Handle folder operations with progress callback
    if (isFolder) {
      return await this.executefolderTransfer(job);
    }

    // Step 1: Download file from source
    let fileContent: Buffer;
    
    if (sourceProvider === 'google') {
      if (!sourceFileId) {
        throw new Error('Source file ID is required for Google Drive');
      }
      const driveService = this.getServiceFromPool('google', job.userId) as GoogleDriveService;
      const downloadedContent = await driveService.downloadFile(sourceFileId);
      // Convert ArrayBuffer to Buffer if needed
      fileContent = downloadedContent instanceof ArrayBuffer 
        ? Buffer.from(downloadedContent) 
        : downloadedContent as Buffer;
    } else if (sourceProvider === 'dropbox') {
      if (!sourceFilePath) {
        throw new Error('Source file path is required for Dropbox');
      }
      const dropboxService = this.getServiceFromPool('dropbox', job.userId) as DropboxService;
      const downloadedContent = await dropboxService.downloadFile(sourceFilePath);
      // Convert ArrayBuffer to Buffer if needed
      fileContent = downloadedContent instanceof ArrayBuffer 
        ? Buffer.from(downloadedContent) 
        : downloadedContent as Buffer;
    } else {
      throw new Error(`Unsupported source provider: ${sourceProvider}`);
    }

    // Check for cancellation after download
    const midJob = await storage.getCopyOperation(job.id);
    if (midJob?.cancelRequested) {
      throw new Error('Job was cancelled by user');
    }

    // Update progress - download completed
    await storage.setJobProgress(job.id, 0, 1, 50);
    this.emit('jobProgress', job.id, job.userId, { completedFiles: 0, totalFiles: 1, progressPct: 50 });

    // Step 2: Upload file to destination
    let result: { copiedFileId?: string; copiedFileName?: string; copiedFileUrl?: string } = {};

    if (destProvider === 'google') {
      const driveService = this.getServiceFromPool('google', job.userId) as GoogleDriveService;
      // Use destinationFolderId from job or fallback to 'root'
      const targetFolderId = destinationFolderId || 'root';
      const uploadResult = await driveService.uploadFile(fileName || 'untitled', fileContent, targetFolderId);
      result = {
        copiedFileId: uploadResult.id,
        copiedFileName: uploadResult.name,
        copiedFileUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`
      };
    } else if (destProvider === 'dropbox') {
      const dropboxService = this.getServiceFromPool('dropbox', job.userId) as DropboxService;
      // Convert Buffer to ArrayBuffer for Dropbox service
      const arrayBufferContent = fileContent.buffer.slice(
        fileContent.byteOffset, 
        fileContent.byteOffset + fileContent.byteLength
      );
      
      // Use destinationFolderId as folder path (DropboxService constructs full path internally)
      const targetFolderPath = destinationFolderId || '';
      const uploadResult = await dropboxService.uploadFile(fileName || 'untitled', arrayBufferContent, targetFolderPath);
      
      // Construct the expected full path for shared link creation
      const fullFilePath = targetFolderPath ? `${targetFolderPath}/${fileName}` : `/${fileName}`;
      
      // Create shared link using the constructed path
      let sharedUrl: string | undefined;
      try {
        const sharedLink = await dropboxService.createSharedLink(fullFilePath);
        sharedUrl = sharedLink.url;
      } catch (error) {
        console.warn(`Failed to create shared link for ${fullFilePath}:`, error);
        // Fallback: try without shared link
        sharedUrl = undefined;
      }
      
      result = {
        copiedFileId: uploadResult.id,
        copiedFileName: uploadResult.name,
        copiedFileUrl: sharedUrl
      };
    } else {
      throw new Error(`Unsupported destination provider: ${destProvider}`);
    }

    // Update progress - upload completed
    await storage.setJobProgress(job.id, 1, 1, 100);
    this.emit('jobProgress', job.id, job.userId, { completedFiles: 1, totalFiles: 1, progressPct: 100 });

    return result;
  }

  private async executefolderTransfer(job: CopyOperation): Promise<{ copiedFileId?: string; copiedFileName?: string; copiedFileUrl?: string }> {
    const { sourceProvider, destProvider, sourceFileId, sourceFilePath, fileName, destinationFolderId, sourceUrl } = job;

    // Create progress callback that emits real-time updates
    const progressCallback = async (completedFiles: number, totalFiles: number, progressPct: number) => {
      // Only emit real-time progress event - services handle database updates
      this.emit('jobProgress', job.id, job.userId, { completedFiles, totalFiles, progressPct });
    };

    let result: { copiedFileId?: string; copiedFileName?: string; copiedFileUrl?: string } = {};

    if (sourceProvider === 'google') {
      if (!sourceUrl) {
        throw new Error('Source URL is required for Google Drive folders');
      }
      const driveService = this.getServiceFromPool('google', job.userId) as GoogleDriveService;
      
      // Parse sourceFileId from URL if not provided
      let actualSourceFileId = sourceFileId;
      if (!actualSourceFileId && sourceUrl) {
        const { fileId } = driveService.parseGoogleDriveUrl(sourceUrl);
        actualSourceFileId = fileId;
      }
      
      // Initial progress setup - let service handle counting for accuracy
      await storage.setJobProgress(job.id, 0, 1, 0);
      this.emit('jobProgress', job.id, job.userId, { completedFiles: 0, totalFiles: 1, progressPct: 0 });

      // Start folder copy with progress callback
      const copiedFolder = await driveService.copyFolderRecursive(
        actualSourceFileId, 
        destinationFolderId, 
        fileName, 
        job.id,
        progressCallback
      );

      result = {
        copiedFileId: copiedFolder.id,
        copiedFileName: copiedFolder.name,
        copiedFileUrl: copiedFolder.webViewLink
      };
    } else if (sourceProvider === 'dropbox') {
      if (!sourceUrl) {
        throw new Error('Source URL is required for Dropbox folders');
      }
      const dropboxService = this.getServiceFromPool('dropbox', job.userId) as DropboxService;
      
      // Initial progress setup - let service handle counting for accuracy
      await storage.setJobProgress(job.id, 0, 1, 0);
      this.emit('jobProgress', job.id, job.userId, { completedFiles: 0, totalFiles: 1, progressPct: 0 });

      // Start folder copy with progress callback
      const copiedFolder = await dropboxService.copyFolderRecursive(
        sourceUrl, 
        destinationFolderId, 
        fileName, 
        job.id,
        '', // relativePath - empty for root level call
        progressCallback
      );

      result = {
        copiedFileId: copiedFolder.id,
        copiedFileName: copiedFolder.name,
        copiedFileUrl: copiedFolder.url
      };
    } else {
      throw new Error(`Unsupported source provider for folders: ${sourceProvider}`);
    }

    return result;
  }

  private calculateBackoffDelay(attempts: number): number {
    // Exponential backoff: min(base * 2^attempts, maxDelay) + jitter
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 60 seconds
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempts - 1), maxDelay);
    
    // Add jitter (up to 20% of the delay)
    const jitter = Math.random() * 0.2 * exponentialDelay;
    
    return exponentialDelay + jitter;
  }

  private isNonRetryableError(error: any): boolean {
    if (!(error instanceof Error)) return false;
    
    const message = error.message.toLowerCase();
    
    // Authentication/authorization errors
    if (message.includes('unauthorized') || 
        message.includes('access denied') || 
        message.includes('invalid token') ||
        message.includes('expired token') ||
        message.includes('not connected')) {
      return true;
    }
    
    // File not found or invalid input
    if (message.includes('not found') || 
        message.includes('invalid file') ||
        message.includes('file too large') ||
        message.includes('unsupported file type')) {
      return true;
    }
    
    // Quota exceeded (not worth retrying immediately)
    if (message.includes('quota exceeded') || 
        message.includes('storage full')) {
      return true;
    }
    
    return false;
  }

  private async performHeartbeat(): Promise<void> {
    try {
      // Reclaim stale jobs more aggressively during heartbeat
      const reclaimedCount = await storage.reclaimStaleJobs(300000); // 5 minutes
      if (reclaimedCount > 0) {
        console.log(`💓 Heartbeat: Reclaimed ${reclaimedCount} stale jobs`);
      }

      // Clean up old completed/failed operations (older than 24 hours)
      const cleanupCount = await this.cleanupOldOperations();
      if (cleanupCount > 0) {
        console.log(`🧹 Heartbeat: Cleaned up ${cleanupCount} old operations`);
      }

      // Clear unused service connections from pool
      this.cleanupServicePool();

      console.log(`💓 Heartbeat: Active jobs: ${this.processingJobs.size}/${this.config.globalConcurrency}, Poll interval: ${this.currentPollInterval}ms`);
    } catch (error) {
      console.error('❌ Error during heartbeat:', error);
    }
  }

  private async cleanupOldOperations(): Promise<number> {
    try {
      // Clean up operations older than 24 hours
      const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const deletedCount = await storage.cleanupOldOperations(cleanupThreshold);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old operations:', error);
      return 0;
    }
  }

  private cleanupServicePool(): void {
    // Clear services that haven't been used recently
    const maxPoolSize = 10;
    if (this.servicePool.size > maxPoolSize) {
      // Simple cleanup: clear half the pool
      const toRemove = Array.from(this.servicePool.keys()).slice(0, Math.floor(this.servicePool.size / 2));
      toRemove.forEach(key => this.servicePool.delete(key));
      console.log(`🧹 Service pool cleanup: Removed ${toRemove.length} unused services`);
    }
  }

  private getServiceFromPool(provider: string, userId: string): GoogleDriveService | DropboxService {
    const poolKey = `${provider}-${userId}`;
    
    if (!this.servicePool.has(poolKey)) {
      if (provider === 'google') {
        this.servicePool.set(poolKey, new GoogleDriveService(userId));
      } else if (provider === 'dropbox') {
        this.servicePool.set(poolKey, new DropboxService(userId));
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    }
    
    return this.servicePool.get(poolKey)!;
  }

  private async executeTransferWithTimeout(job: CopyOperation): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Transfer timeout after ${this.config.connectionTimeout}ms`));
      }, this.config.connectionTimeout);

      this.executeTransfer(job)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      workerId: this.config.workerId,
      processingJobs: this.processingJobs.size,
      globalConcurrency: this.config.globalConcurrency,
      userLimits: this.userLimits,
      currentPollInterval: this.currentPollInterval,
      consecutiveEmptyPolls: this.consecutiveEmptyPolls,
      servicePoolSize: this.servicePool.size
    };
  }
}

// Global worker instance
let globalWorker: QueueWorker | null = null;

export function startQueueWorker(config?: Partial<WorkerConfig>): QueueWorker {
  if (globalWorker) {
    console.log('Queue worker already exists, returning existing instance');
    return globalWorker;
  }

  globalWorker = new QueueWorker(config);
  globalWorker.start();
  
  return globalWorker;
}

export function getQueueWorker(): QueueWorker | null {
  return globalWorker;
}

export async function stopQueueWorker(): Promise<void> {
  if (globalWorker) {
    await globalWorker.stop();
    globalWorker = null;
  }
}