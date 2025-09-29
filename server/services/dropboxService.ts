import { Dropbox } from 'dropbox';
import { storage } from '../storage';

export interface DropboxFile {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  url?: string;
}

export interface DropboxAuthStatus {
  connected: boolean;
  hasValidToken: boolean;
}

interface ProgressContext {
  completedFiles: number;
  totalFiles: number;
  operationId: string;
  onProgress?: (completedFiles: number, totalFiles: number, progressPct: number) => Promise<void>;
}

export class DropboxService {
  private dbx: Dropbox;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.dbx = new Dropbox({
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      fetch: fetch,
    });
  }

  private async ensureValidToken(): Promise<void> {
    const user = await storage.getUser(this.userId);
    
    if (!user?.dropboxAccessToken && !user?.dropboxRefreshToken) {
      throw new Error('User has not connected their Dropbox account');
    }

    // If we have access token, set it
    if (user.dropboxAccessToken) {
      this.dbx.setAccessToken(user.dropboxAccessToken);
    }
    
    // Set refresh token if available
    if (user.dropboxRefreshToken) {
      this.dbx.auth.setRefreshToken(user.dropboxRefreshToken);
    }
    
    // Add small buffer (60s) to handle clock skew
    const bufferTime = 60 * 1000; // 60 seconds in milliseconds
    const isTokenExpired = user.dropboxTokenExpiry && 
      new Date(user.dropboxTokenExpiry.getTime() - bufferTime) <= new Date();
    
    // Refresh token if expired OR if we don't have access token but have refresh token
    if ((!user.dropboxAccessToken || isTokenExpired) && user.dropboxRefreshToken) {
      try {
        console.log('Refreshing Dropbox token...');
        const response = await this.dbx.auth.refreshAccessToken();
        
        // Update tokens in database with new values
        const newExpiresAt = response.result.expires_in ? 
          new Date(Date.now() + (response.result.expires_in * 1000)) : null;
        
        await storage.updateUserDropboxTokens(this.userId, {
          accessToken: response.result.access_token,
          refreshToken: response.result.refresh_token || user.dropboxRefreshToken,
          expiry: newExpiresAt
        });

        // Update the SDK with new access token
        this.dbx.setAccessToken(response.result.access_token);
      } catch (error) {
        console.error('Failed to refresh Dropbox token:', error);
        throw new Error('Dropbox access token has expired. Please reconnect your account.');
      }
    }
    
    // Final check - ensure we have an access token set
    const currentToken = this.dbx.auth?.getAccessToken?.() || this.dbx.getAccessToken();
    if (!currentToken) {
      throw new Error('Unable to obtain valid Dropbox access token. Please reconnect your account.');
    }
  }

  async getAuthUrl(redirectUrl: string, state: string): Promise<string> {
    // Request offline access to get refresh tokens
    return this.dbx.getAuthenticationUrl(redirectUrl, state, 'code', 'offline');
  }

  async exchangeCodeForToken(redirectUrl: string, code: string): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
    const response = await this.dbx.auth.getAccessTokenFromCode(redirectUrl, code);
    return {
      accessToken: response.result.access_token,
      refreshToken: response.result.refresh_token,
      // Dropbox returns expires_in (seconds), convert to absolute date
      expiresAt: response.result.expires_in ? new Date(Date.now() + (response.result.expires_in * 1000)) : undefined
    };
  }

  parseDropboxUrl(url: string): { sharedUrl: string; type: 'file' | 'folder'; filePath?: string } {
    // Remove query parameters for parsing
    const baseUrl = url.split('?')[0];
    
    // File patterns:
    // https://www.dropbox.com/s/[ID]/[filename]
    // https://www.dropbox.com/scl/fi/[ID]/[filename]
    const fileMatch = baseUrl.match(/dropbox\.com\/(?:s|scl\/fi)\/([^\/]+)\/(.+)/);
    
    // Folder patterns:
    // https://www.dropbox.com/sh/[ID]/[shared_id]
    // https://www.dropbox.com/scl/fo/[ID]/[folder_name] (modern format)
    const folderMatch = baseUrl.match(/dropbox\.com\/(?:sh|scl\/fo)\/([^\/]+)\/([^\/]+)/);
    
    if (fileMatch) {
      const [, fileId, filename] = fileMatch;
      return { 
        sharedUrl: url,
        type: 'file',
        filePath: `/${filename}`
      };
    } else if (folderMatch) {
      return { 
        sharedUrl: url,
        type: 'folder'
      };
    } else {
      throw new Error('Invalid Dropbox URL format. Supported formats: https://dropbox.com/s/... (files), https://dropbox.com/sh/... (folders), or https://dropbox.com/scl/... (modern formats)');
    }
  }

  async getAccountInfo() {
    await this.ensureValidToken();
    
    try {
      const account = await this.dbx.usersGetCurrentAccount();
      return {
        id: account.result.account_id,
        email: account.result.email,
        name: account.result.name.display_name,
      };
    } catch (error) {
      console.error('Error getting Dropbox account info:', error);
      throw new Error('Failed to get Dropbox account information');
    }
  }

  async listFiles(path: string = ''): Promise<DropboxFile[]> {
    await this.ensureValidToken();
    
    try {
      const response = await this.dbx.filesListFolder({
        path: path || '',
        recursive: false,
        include_media_info: true,
      });

      return response.result.entries.map((entry: any) => ({
        id: entry.id || entry.path_lower,
        name: entry.name,
        size: entry.size || undefined,
        mimeType: entry['.tag'] === 'folder' ? 'application/vnd.dropbox.folder' : this.getMimeTypeFromName(entry.name),
        url: undefined, // Dropbox doesn't provide direct URLs in list
      }));
    } catch (error) {
      console.error('Error listing Dropbox files:', error);
      throw new Error('Failed to list Dropbox files');
    }
  }

  async uploadFile(filename: string, content: ArrayBuffer, destinationPath?: string): Promise<DropboxFile> {
    await this.ensureValidToken();
    
    try {
      const fullPath = destinationPath ? `${destinationPath}/${filename}` : `/${filename}`;
      const fileSize = content.byteLength;
      const maxRegularUploadSize = 150 * 1024 * 1024; // 150MB
      const maxDropboxSize = 350 * 1024 * 1024 * 1024; // 350GB maximum for Dropbox
      
      // Check file size limit
      if (fileSize > maxDropboxSize) {
        throw new Error(`File size (${Math.round(fileSize / 1024 / 1024 / 1024)}GB) exceeds Dropbox maximum limit of 350GB`);
      }
      
      // Use upload sessions for files larger than 150MB
      if (fileSize > maxRegularUploadSize) {
        console.log(`Large file detected (${Math.round(fileSize / 1024 / 1024)}MB), using upload sessions`);
        return await this.uploadLargeFile(filename, content, fullPath);
      }
      
      // Regular upload for smaller files
      const response = await this.dbx.filesUpload({
        path: fullPath,
        contents: content,
        mode: 'add',
        autorename: true,
      });

      return {
        id: response.result.id,
        name: response.result.name,
        size: response.result.size,
        mimeType: this.getMimeTypeFromName(response.result.name),
      };
    } catch (error) {
      console.error('Error uploading file to Dropbox:', error);
      throw new Error('Failed to upload file to Dropbox');
    }
  }

  private async uploadLargeFile(filename: string, content: ArrayBuffer, fullPath: string): Promise<DropboxFile> {
    const chunkSize = 4 * 1024 * 1024; // 4MB chunks for optimal performance
    const totalSize = content.byteLength;
    const totalChunks = Math.ceil(totalSize / chunkSize);
    
    console.log(`Uploading ${filename} in ${totalChunks} chunks of ${chunkSize / 1024 / 1024}MB each`);
    
    try {
      // Start upload session with first chunk
      const firstChunk = content.slice(0, Math.min(chunkSize, totalSize));
      const startResponse = await this.dbx.filesUploadSessionStart({
        contents: firstChunk,
        close: false,
      });
      
      const sessionId = startResponse.result.session_id;
      let cursor = { session_id: sessionId, offset: firstChunk.byteLength };
      
      // Upload remaining chunks
      for (let i = 1; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, totalSize);
        const chunk = content.slice(start, end);
        const isLastChunk = i === totalChunks - 1;
        
        console.log(`Uploading chunk ${i + 1}/${totalChunks} (${Math.round(start / 1024 / 1024)}-${Math.round(end / 1024 / 1024)}MB)`);
        
        if (isLastChunk) {
          // Finish upload session with last chunk
          const finishResponse = await this.dbx.filesUploadSessionFinish({
            cursor: cursor,
            commit: {
              path: fullPath,
              mode: 'add',
              autorename: true,
            },
            contents: chunk,
          });
          
          return {
            id: finishResponse.result.id,
            name: finishResponse.result.name,
            size: finishResponse.result.size,
            mimeType: this.getMimeTypeFromName(finishResponse.result.name),
          };
        } else {
          // Append chunk to session
          await this.dbx.filesUploadSessionAppendV2({
            cursor: cursor,
            contents: chunk,
            close: false,
          });
          
          cursor.offset += chunk.byteLength;
        }
      }
      
      throw new Error('Upload session completed unexpectedly');
    } catch (error) {
      console.error('Error in large file upload:', error);
      throw new Error(`Failed to upload large file: ${error.message}`);
    }
  }

  async downloadFile(path: string): Promise<ArrayBuffer> {
    await this.ensureValidToken();
    
    try {
      const response = await this.dbx.filesDownload({ path });
      return response.result.fileBinary as ArrayBuffer;
    } catch (error) {
      console.error('Error downloading file from Dropbox:', error);
      throw new Error('Failed to download file from Dropbox');
    }
  }

  async createFolder(path: string): Promise<DropboxFile> {
    await this.ensureValidToken();
    
    try {
      const response = await this.dbx.filesCreateFolderV2({
        path: path,
        autorename: true,
      });

      return {
        id: response.result.metadata.id,
        name: response.result.metadata.name,
        mimeType: 'application/vnd.dropbox.folder',
      };
    } catch (error) {
      console.error('Error creating folder in Dropbox:', error);
      throw new Error('Failed to create folder in Dropbox');
    }
  }

  async getSharedLinkMetadata(sharedUrl: string): Promise<DropboxFile> {
    await this.ensureValidToken();
    
    try {
      const response = await this.dbx.sharingGetSharedLinkMetadata({
        url: sharedUrl
      });
      
      const metadata = response.result;
      return {
        id: metadata.id || metadata.path_lower || '',
        name: metadata.name,
        size: metadata.size || undefined,
        mimeType: metadata['.tag'] === 'folder' ? 'application/vnd.dropbox.folder' : this.getMimeTypeFromName(metadata.name),
        url: sharedUrl
      };
    } catch (error) {
      console.error('Error getting shared link metadata:', error);
      throw new Error('Failed to get shared link metadata');
    }
  }

  async listSharedFolderContents(sharedUrl: string, path: string = ''): Promise<DropboxFile[]> {
    await this.ensureValidToken();
    
    try {
      let allEntries: any[] = [];
      let cursor: string | undefined = undefined;
      let hasMore = true;

      // Handle pagination with multiple requests if needed
      while (hasMore) {
        let response;
        
        if (cursor) {
          // Continue with cursor
          response = await this.dbx.filesListFolderContinue({ cursor });
        } else {
          // Initial request
          response = await this.dbx.filesListFolder({
            path: path,
            shared_link: {
              url: sharedUrl
            },
            recursive: false,
            include_media_info: true
          });
        }

        allEntries.push(...response.result.entries);
        hasMore = response.result.has_more;
        cursor = response.result.cursor;
      }

      return allEntries.map((entry: any) => ({
        id: entry.id || entry.path_lower,
        name: entry.name,
        size: entry.size || undefined,
        mimeType: entry['.tag'] === 'folder' ? 'application/vnd.dropbox.folder' : this.getMimeTypeFromName(entry.name),
        url: sharedUrl
      }));
    } catch (error) {
      console.error('Error listing shared folder contents:', error);
      throw new Error('Failed to list shared folder contents');
    }
  }

  async downloadFileFromSharedLink(sharedUrl: string, filePath?: string): Promise<ArrayBuffer> {
    await this.ensureValidToken();
    
    try {
      // For direct file links (like /s/[ID]/[filename]), don't pass path
      // For folder links with specific file, pass the path
      const requestOptions: any = { url: sharedUrl };
      if (filePath && filePath !== '/') {
        requestOptions.path = filePath;
      }
      
      const response = await this.dbx.sharingGetSharedLinkFile(requestOptions);
      
      return response.result.fileBinary as ArrayBuffer;
    } catch (error) {
      console.error('Error downloading file from shared link:', error);
      throw new Error('Failed to download file from shared link');
    }
  }

  private async countFilesRecursively(sharedUrl: string, relativePath: string = ''): Promise<number> {
    try {
      const files = await this.listSharedFolderContents(sharedUrl, relativePath);
      let count = 0;
      
      for (const file of files) {
        if (file.mimeType === 'application/vnd.dropbox.folder') {
          // Recursively count files in subfolder
          const subPath = relativePath ? `${relativePath}/${file.name}` : `/${file.name}`;
          count += await this.countFilesRecursively(sharedUrl, subPath);
        } else {
          // Count individual files only
          count++;
        }
      }
      
      return count;
    } catch (error) {
      console.error('Error counting files recursively:', error);
      return 0; // Return 0 if counting fails to avoid breaking the operation
    }
  }

  private async incrementProgress(operationId?: string): Promise<void> {
    if (!operationId) return;
    
    try {
      // Get current operation state
      const operation = await storage.getCopyOperation(operationId);
      if (operation) {
        const newCompletedFiles = (operation.completedFiles || 0) + 1;
        await storage.updateCopyOperation(operationId, {
          completedFiles: newCompletedFiles
        });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      // Don't throw - progress update failures shouldn't break the operation
    }
  }

  private async copyFolderRecursiveInternal(
    sharedUrl: string,
    destinationPath?: string,
    newFolderName?: string,
    progressContext?: ProgressContext,
    relativePath: string = ''
  ): Promise<DropboxFile> {
    try {
      // Get source folder metadata
      const sourceFolder = await this.getSharedLinkMetadata(sharedUrl);
      const folderName = newFolderName || `Copy of ${sourceFolder.name}`;
      
      // Create destination path
      const targetPath = destinationPath ? `${destinationPath}/${folderName}` : `/${folderName}`;
      
      // Create new folder
      const newFolder = await this.createFolder(targetPath);
      
      // Save the new folder to drive_files table (using same table as Google Drive for consistency)
      try {
        await storage.createCloudFile({
          userId: this.userId,
          provider: 'dropbox',
          originalFileId: sourceFolder.id,
          copiedFileId: newFolder.id!,
          fileName: newFolder.name!,
          mimeType: newFolder.mimeType,
          fileSize: null, // Folders don't have file size
          sourceUrl: sharedUrl
        });
        console.log(`📂 Archived Dropbox folder ${newFolder.name} in drive_files table`);
      } catch (error) {
        console.error(`Failed to save Dropbox folder ${newFolder.name} to drive_files:`, error);
      }

      // List all files and folders in the shared folder
      const files = await this.listSharedFolderContents(sharedUrl, relativePath);

      // Copy each file/folder
      for (const file of files) {
        try {
          let copiedFile: DropboxFile;
          const sourceFilePath = relativePath ? `${relativePath}/${file.name}` : `/${file.name}`;
          
          if (file.mimeType === 'application/vnd.dropbox.folder') {
            // Recursively copy subfolders - Pass progress context to track progress in all levels
            copiedFile = await this.copyFolderRecursiveInternal(
              sharedUrl, 
              targetPath, 
              file.name,
              progressContext, // Pass progress context to subfolder operations
              sourceFilePath
            );
          } else {
            // Copy individual files
            const fileContent = await this.downloadFileFromSharedLink(sharedUrl, sourceFilePath);
            copiedFile = await this.uploadFile(file.name, fileContent, targetPath);
            
            // Save individual file to drive_files table
            try {
              await storage.createCloudFile({
                userId: this.userId,
                provider: 'dropbox',
                originalFileId: file.id,
                copiedFileId: copiedFile.id!,
                fileName: copiedFile.name!,
                mimeType: copiedFile.mimeType,
                fileSize: copiedFile.size ? Number(copiedFile.size) || null : null,
                sourceUrl: sharedUrl
              });
              console.log(`📁 Archived individual Dropbox file ${copiedFile.name} in drive_files table`);
            } catch (error) {
              console.error(`Failed to save Dropbox file ${copiedFile.name} to drive_files:`, error);
            }

            // Increment progress counter for files only (not folders)
            if (progressContext) {
              progressContext.completedFiles++;
              // Calculate progress percentage using proper total
              const progressPct = Math.min(100, Math.round((progressContext.completedFiles / Math.max(1, progressContext.totalFiles)) * 100));
              // Update progress in database
              await storage.setJobProgress(
                progressContext.operationId, 
                progressContext.completedFiles, 
                progressContext.totalFiles,
                progressPct
              );
              // Emit real-time progress update if callback is provided
              if (progressContext.onProgress) {
                await progressContext.onProgress(progressContext.completedFiles, progressContext.totalFiles, progressPct);
              }
            }
          }

        } catch (error) {
          console.error(`Error copying Dropbox file ${file.name}:`, error);
          // Continue with other files even if one fails
          if (progressContext) {
            await storage.updateCopyOperation(progressContext.operationId, {
              errorMessage: `Failed to copy file: ${file.name}. ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          }
        }
      }

      // Only mark operation as completed at the root level
      if (progressContext && !relativePath) {
        await storage.updateCopyOperation(progressContext.operationId, {
          status: 'completed'
        });
      }

      return newFolder;
      
    } catch (error) {
      console.error('Error in copyFolderRecursiveInternal for Dropbox:', error);
      
      if (progressContext) {
        await storage.updateCopyOperation(progressContext.operationId, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  /**
   * Public interface for copying folders recursively
   */
  async copyFolderRecursive(
    sharedUrl: string,
    destinationPath?: string,
    newFolderName?: string,
    operationId?: string,
    relativePath: string = '',
    onProgress?: (completedFiles: number, totalFiles: number, progressPct: number) => Promise<void>
  ): Promise<DropboxFile> {
    if (operationId && !relativePath) {
      // Only create progress context at root level
      const totalFiles = await this.countFilesRecursively(sharedUrl, relativePath);
      
      const progressContext: ProgressContext = {
        completedFiles: 0,
        totalFiles: totalFiles,
        operationId,
        onProgress
      };
      
      // Set total files once at the beginning
      await storage.updateCopyOperation(operationId, {
        status: 'in_progress',
        totalFiles,
        completedFiles: 0
      });
      
      return this.copyFolderRecursiveInternal(sharedUrl, destinationPath, newFolderName, progressContext, relativePath);
    } else {
      // No progress tracking needed or subfolder call
      return this.copyFolderRecursiveInternal(sharedUrl, destinationPath, newFolderName, undefined, relativePath);
    }
  }

  async copyFileFromSharedLink(
    sharedUrl: string,
    sourceFilePath: string | undefined,
    filename: string
  ): Promise<DropboxFile> {
    try {
      // Download file from shared link
      // For direct file links, sourceFilePath might be undefined or '/'
      const fileContent = await this.downloadFileFromSharedLink(sharedUrl, sourceFilePath);
      
      // Upload to user's Dropbox (no destination path means root folder)
      const copiedFile = await this.uploadFile(filename, fileContent);
      
      return copiedFile;
    } catch (error) {
      console.error('Error copying file from shared link:', error);
      throw new Error(`Failed to copy file from shared link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async startCopyFromUrl(operationId: string, sourceUrl: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { sharedUrl, type, filePath } = this.parseDropboxUrl(sourceUrl);
      
      await storage.updateCopyOperation(operationId, {
        status: 'in_progress'
      });

      let result: DropboxFile;

      if (type === 'folder') {
        result = await this.copyFolderRecursive(sharedUrl, undefined, undefined, operationId);
      } else {
        // For single file, copy from shared link
        const filename = filePath?.split('/').pop() || 'untitled';
        // For direct file links, don't pass the file path since it's embedded in the URL
        result = await this.copyFileFromSharedLink(sharedUrl, undefined, filename);
        await storage.updateCopyOperation(operationId, {
          totalFiles: 1,
          completedFiles: 1
        });
      }

      // Calculate duration
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Complete operation with all data
      await storage.updateCopyOperation(operationId, {
        status: 'completed',
        copiedFileId: result.id,
        copiedFileName: result.name,
        copiedFileUrl: await this.getSharedLink(`/${result.name}`), // Create shared link for copied file
        duration: duration
      });

      // Save individual files to drive_files table (folders are handled in copyFolderRecursive)
      if (type !== 'folder') {
        try {
          await storage.createCloudFile({
            userId: this.userId,
            provider: 'dropbox',
            originalFileId: filePath || sourceUrl,
            copiedFileId: result.id!,
            fileName: result.name!,
            mimeType: result.mimeType,
            fileSize: result.size ? Number(result.size) || null : null,
            sourceUrl: sourceUrl
          });
          console.log(`✅ Archived Dropbox file ${result.name} in drive_files table`);
        } catch (error) {
          console.error('Failed to save Dropbox file to drive_files table:', error);
        }
      } else {
        console.log(`📂 Dropbox folder ${result.name} and contents archived via copyFolderRecursive`);
      }

      // Send completion email (reuse same email service)
      // await this.sendCompletionEmail(operationId, result, duration);

    } catch (error) {
      console.error('Dropbox copy operation failed:', error);
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      await storage.updateCopyOperation(operationId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration: duration
      });
    }
  }

  async getOperationPreview(sourceUrl: string): Promise<any> {
    try {
      const { sharedUrl, type, filePath } = this.parseDropboxUrl(sourceUrl);
      
      if (type === 'file') {
        // For files, get metadata from shared link
        const fileMetadata = await this.getSharedLinkMetadata(sharedUrl);
        
        return {
          name: fileMetadata.name,
          type: 'file',
          totalFiles: 1,
          totalFolders: 0,
          totalSize: fileMetadata.size || 0,
          estimatedDurationSeconds: Math.max(1, Math.ceil((fileMetadata.size || 0) / (1024 * 1024))), // Rough estimate: 1 second per MB
          fileTypes: {
            [this.getFileType(fileMetadata.mimeType)]: 1
          },
          structure: {
            name: fileMetadata.name,
            type: 'file',
            size: fileMetadata.size || 0
          }
        };
      } else {
        // For folders, analyze structure
        const folderMetadata = await this.getSharedLinkMetadata(sharedUrl);
        const analysis = await this.analyzeDropboxStructureRecursive(sharedUrl, '', folderMetadata.name);
        
        // Estimate duration based on file count and size
        const estimatedDurationSeconds = Math.max(5, Math.ceil(analysis.totalSize / (1024 * 1024 * 2))); // Rough estimate: 2MB per second
        
        return {
          name: folderMetadata.name,
          type: 'folder',
          totalFiles: analysis.fileCount,
          totalFolders: analysis.folderCount,
          totalSize: analysis.totalSize,
          estimatedDurationSeconds,
          fileTypes: analysis.fileTypes,
          structure: analysis.structure
        };
      }
    } catch (error) {
      console.error('Error getting Dropbox operation preview:', error);
      throw error;
    }
  }

  private async analyzeDropboxStructureRecursive(sharedUrl: string, relativePath: string, folderName: string): Promise<{
    fileCount: number;
    folderCount: number;
    totalSize: number;
    fileTypes: { [key: string]: number };
    structure: any;
  }> {
    const files = await this.listSharedFolderContents(sharedUrl, relativePath);
    let fileCount = 0;
    let folderCount = 0;
    let totalSize = 0;
    const fileTypes: { [key: string]: number } = {};
    const children: any[] = [];

    for (const file of files) {
      if (file.mimeType === 'application/vnd.dropbox.folder') {
        folderCount++;
        const subPath = relativePath ? `${relativePath}/${file.name}` : `/${file.name}`;
        const subAnalysis = await this.analyzeDropboxStructureRecursive(sharedUrl, subPath, file.name);
        fileCount += subAnalysis.fileCount;
        folderCount += subAnalysis.folderCount;
        totalSize += subAnalysis.totalSize;
        
        // Merge file types
        for (const [type, count] of Object.entries(subAnalysis.fileTypes)) {
          fileTypes[type] = (fileTypes[type] || 0) + count;
        }
        
        children.push(subAnalysis.structure);
      } else {
        fileCount++;
        totalSize += file.size || 0;
        const fileType = this.getFileType(file.mimeType);
        fileTypes[fileType] = (fileTypes[fileType] || 0) + 1;
        
        children.push({
          name: file.name,
          type: 'file',
          size: file.size || 0
        });
      }
    }

    return {
      fileCount,
      folderCount,
      totalSize,
      fileTypes,
      structure: {
        name: folderName,
        type: 'folder',
        children: children.slice(0, 10) // Limit to first 10 items for preview
      }
    };
  }

  private getFileType(mimeType?: string): string {
    if (!mimeType) return 'other';
    
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'documents';
    if (mimeType.includes('document') || mimeType.includes('text')) return 'documents';
    if (mimeType.includes('spreadsheet')) return 'documents';
    if (mimeType.includes('presentation')) return 'documents';
    
    return 'other';
  }

  async getSharedLink(path: string): Promise<string> {
    await this.ensureValidToken();
    
    try {
      // Try to get existing shared link first
      try {
        const existingLinks = await this.dbx.sharingListSharedLinks({
          path: path,
          direct_only: true,
        });
        
        if (existingLinks.result.links.length > 0) {
          return existingLinks.result.links[0].url;
        }
      } catch (error) {
        // No existing shared link, create a new one
      }

      // Create new shared link
      const response = await this.dbx.sharingCreateSharedLinkWithSettings({
        path: path,
        settings: {
          requested_visibility: 'public',
          audience: 'public',
          access: 'viewer',
        },
      });

      return response.result.url;
    } catch (error) {
      console.error('Error creating Dropbox shared link:', error);
      throw new Error('Failed to create shared link');
    }
  }

  private getMimeTypeFromName(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  /**
   * List only folders in a path for navigation (similar to Google Drive listFolders)
   */
  async listFolders(path: string = "/", cursor?: string): Promise<{
    folders: DropboxFile[];
    nextCursor?: string;
  }> {
    await this.ensureValidToken();
    
    try {
      let response;
      
      if (cursor) {
        response = await this.dbx.filesListFolderContinue({ cursor });
      } else {
        response = await this.dbx.filesListFolder({
          path: path === "/" ? "" : path, // Dropbox uses empty string for root
          recursive: false,
          include_media_info: false,
        });
      }

      // Filter only folders and convert to DropboxFile format
      const folders = response.result.entries
        .filter((entry: any) => entry['.tag'] === 'folder')
        .map((folder: any) => ({
          id: folder.path_lower,
          name: folder.name,
          mimeType: 'application/vnd.dropbox.folder',
        }));

      return {
        folders,
        nextCursor: response.result.has_more ? response.result.cursor : undefined,
      };
    } catch (error) {
      console.error('Error listing Dropbox folders:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('access token has expired')) {
          throw new Error('Dropbox access token has expired. Please reconnect your account.');
        }
        if (error.message.includes('not connected')) {
          throw new Error('Dropbox account not connected');
        }
      }
      
      // Check for specific Dropbox API errors
      const dropboxError = (error as any)?.error?.error_summary || (error as any)?.error;
      if (dropboxError) {
        if (dropboxError.includes('path/not_found') || dropboxError.includes('not_found')) {
          throw new Error('path_not_found: Folder path not found');
        }
        if (dropboxError.includes('path/malformed') || dropboxError.includes('malformed_path')) {
          throw new Error('path_malformed: Invalid folder path format');
        }
      }
      
      throw new Error('Failed to list Dropbox folders');
    }
  }

  /**
   * Get folder path for breadcrumbs (similar to Google Drive getFolderPath)
   */
  async getFolderPath(path: string): Promise<{ path: string; name: string }[]> {
    await this.ensureValidToken();

    try {
      const breadcrumbs: { path: string; name: string }[] = [];
      
      // Always start with root
      breadcrumbs.push({ path: "/", name: "Mi Dropbox" });

      // If it's root path, return just root
      if (path === "/" || path === "") {
        return breadcrumbs;
      }

      // Split the path and build breadcrumbs
      const pathParts = path.split('/').filter(part => part.length > 0);
      let currentPath = "";

      for (const part of pathParts) {
        currentPath += "/" + part;
        
        try {
          // Get folder metadata to ensure it exists and get the display name
          const metadata = await this.dbx.filesGetMetadata({ path: currentPath });
          
          if (metadata.result['.tag'] === 'folder') {
            breadcrumbs.push({
              path: currentPath,
              name: metadata.result.name
            });
          } else {
            throw new Error(`path_not_found: Path ${currentPath} is not a folder`);
          }
        } catch (metadataError) {
          console.error(`Error getting metadata for ${currentPath}:`, metadataError);
          
          // Check for specific Dropbox API errors and propagate them
          const dropboxError = (metadataError as any)?.error?.error_summary || (metadataError as any)?.error;
          if (dropboxError) {
            if (dropboxError.includes('path/not_found') || dropboxError.includes('not_found')) {
              throw new Error(`path_not_found: Folder path ${currentPath} not found`);
            }
            if (dropboxError.includes('path/malformed') || dropboxError.includes('malformed_path')) {
              throw new Error(`path_malformed: Invalid folder path format at ${currentPath}`);
            }
          }
          
          // If it's not a recognized Dropbox error, treat it as path not found
          throw new Error(`path_not_found: Folder path ${currentPath} not found`);
        }
      }

      return breadcrumbs;
    } catch (error) {
      console.error('Error getting Dropbox folder path:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('access token has expired')) {
          throw new Error('Dropbox access token has expired. Please reconnect your account.');
        }
        if (error.message.includes('not connected')) {
          throw new Error('Dropbox account not connected');
        }
      }
      
      // Check for specific Dropbox API errors
      const dropboxError = (error as any)?.error?.error_summary || (error as any)?.error;
      if (dropboxError) {
        if (dropboxError.includes('path/not_found') || dropboxError.includes('not_found')) {
          throw new Error('path_not_found: Folder path not found');
        }
        if (dropboxError.includes('path/malformed') || dropboxError.includes('malformed_path')) {
          throw new Error('path_malformed: Invalid folder path format');
        }
      }
      
      throw new Error('Failed to get Dropbox folder path');
    }
  }

  /**
   * Alias for startCopyFromUrl to match GoogleDriveService interface
   * Start copy operation (background process)
   */
  async startCopyOperation(operationId: string, sourceUrl: string): Promise<void> {
    return this.startCopyFromUrl(operationId, sourceUrl);
  }
}