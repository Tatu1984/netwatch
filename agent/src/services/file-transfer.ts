import * as fs from 'fs';
import * as path from 'path';
import { AgentService } from './agent-service';

interface TransferInfo {
  transferId: string;
  direction: 'UPLOAD' | 'DOWNLOAD';
  remotePath: string;
  localPath?: string;
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export class FileTransfer {
  private agentService: AgentService;
  private activeTransfers: Map<string, TransferInfo> = new Map();
  private chunkSize = 1024 * 64; // 64KB chunks

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  registerHandlers(): void {
    this.agentService.on('file_transfer', async (data: {
      transferId: string;
      direction: 'UPLOAD' | 'DOWNLOAD';
      remotePath: string;
      fileData?: string;
    }) => {
      if (data.direction === 'DOWNLOAD') {
        await this.handleDownload(data.transferId, data.remotePath);
      } else if (data.direction === 'UPLOAD' && data.fileData) {
        await this.handleUpload(data.transferId, data.remotePath, data.fileData);
      }
    });

    console.log('File transfer service registered');
  }

  private async handleDownload(transferId: string, remotePath: string): Promise<void> {
    console.log(`Starting download: ${remotePath}`);

    try {
      // Check if file exists
      if (!fs.existsSync(remotePath)) {
        throw new Error(`File not found: ${remotePath}`);
      }

      const stats = fs.statSync(remotePath);

      if (stats.isDirectory()) {
        throw new Error('Cannot download directories');
      }

      const totalBytes = stats.size;

      // Create transfer info
      const transfer: TransferInfo = {
        transferId,
        direction: 'DOWNLOAD',
        remotePath,
        progress: 0,
        bytesTransferred: 0,
        totalBytes,
      };

      this.activeTransfers.set(transferId, transfer);

      // Read file in chunks and send
      const fileContent = fs.readFileSync(remotePath);
      const base64Content = fileContent.toString('base64');

      // For small files, send all at once
      if (totalBytes < this.chunkSize * 10) {
        this.agentService.sendFileTransferProgress(transferId, 100, totalBytes);

        // Emit file content through socket
        // In a real implementation, you'd send this through a dedicated channel
        console.log(`Download complete: ${remotePath} (${totalBytes} bytes)`);
      } else {
        // For larger files, simulate chunked transfer
        let bytesTransferred = 0;

        while (bytesTransferred < totalBytes) {
          bytesTransferred = Math.min(bytesTransferred + this.chunkSize, totalBytes);
          const progress = Math.floor((bytesTransferred / totalBytes) * 100);

          this.agentService.sendFileTransferProgress(transferId, progress, bytesTransferred);
          transfer.progress = progress;
          transfer.bytesTransferred = bytesTransferred;

          // Small delay to not overwhelm the connection
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      this.activeTransfers.delete(transferId);

    } catch (error) {
      console.error(`Download failed: ${error}`);
      this.activeTransfers.delete(transferId);
    }
  }

  private async handleUpload(transferId: string, remotePath: string, fileData: string): Promise<void> {
    console.log(`Starting upload to: ${remotePath}`);

    try {
      // Decode base64 data
      const buffer = Buffer.from(fileData, 'base64');
      const totalBytes = buffer.length;

      // Create transfer info
      const transfer: TransferInfo = {
        transferId,
        direction: 'UPLOAD',
        remotePath,
        progress: 0,
        bytesTransferred: 0,
        totalBytes,
      };

      this.activeTransfers.set(transferId, transfer);

      // Ensure directory exists
      const dir = path.dirname(remotePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(remotePath, buffer);

      // Report complete
      this.agentService.sendFileTransferProgress(transferId, 100, totalBytes);
      console.log(`Upload complete: ${remotePath} (${totalBytes} bytes)`);

      this.activeTransfers.delete(transferId);

    } catch (error) {
      console.error(`Upload failed: ${error}`);
      this.activeTransfers.delete(transferId);
    }
  }

  // List directory contents
  listDirectory(dirPath: string): Array<{
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modified: Date;
  }> {
    try {
      const items = fs.readdirSync(dirPath);

      return items.map(item => {
        const fullPath = path.join(dirPath, item);
        const stats = fs.statSync(fullPath);

        return {
          name: item,
          path: fullPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
        };
      });
    } catch (error) {
      console.error(`Failed to list directory: ${error}`);
      return [];
    }
  }

  // Delete file or directory
  delete(targetPath: string): boolean {
    try {
      const stats = fs.statSync(targetPath);

      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true });
      } else {
        fs.unlinkSync(targetPath);
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete: ${error}`);
      return false;
    }
  }

  // Create directory
  createDirectory(dirPath: string): boolean {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      return true;
    } catch (error) {
      console.error(`Failed to create directory: ${error}`);
      return false;
    }
  }

  // Rename/move file or directory
  rename(oldPath: string, newPath: string): boolean {
    try {
      fs.renameSync(oldPath, newPath);
      return true;
    } catch (error) {
      console.error(`Failed to rename: ${error}`);
      return false;
    }
  }

  getActiveTransfers(): TransferInfo[] {
    return Array.from(this.activeTransfers.values());
  }

  cancelTransfer(transferId: string): void {
    this.activeTransfers.delete(transferId);
  }
}
