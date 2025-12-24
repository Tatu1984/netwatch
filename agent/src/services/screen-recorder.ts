import { desktopCapturer, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AgentService } from './agent-service';

interface RecordingSession {
  id: string;
  startTime: number;
  chunks: Buffer[];
  isRecording: boolean;
}

export class ScreenRecorder {
  private agentService: AgentService;
  private recordingSession: RecordingSession | null = null;
  private recordingsDir: string;
  private recorderWindow: BrowserWindow | null = null;

  constructor(agentService: AgentService) {
    this.agentService = agentService;
    this.recordingsDir = path.join(os.homedir(), '.netwatch', 'recordings');
    this.ensureRecordingsDir();
    this.registerHandlers();
  }

  private ensureRecordingsDir(): void {
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  private registerHandlers(): void {
    this.agentService.on('command', async (data: { id: string; command: string; payload?: Record<string, unknown> }) => {
      if (data.command === 'START_RECORDING') {
        try {
          const recordingId = await this.startRecording();
          this.agentService.sendCommandResponse(data.id, true, recordingId);
        } catch (error) {
          this.agentService.sendCommandResponse(data.id, false, undefined, String(error));
        }
      }

      if (data.command === 'STOP_RECORDING') {
        try {
          const result = await this.stopRecording();
          this.agentService.sendCommandResponse(data.id, true, JSON.stringify(result));
        } catch (error) {
          this.agentService.sendCommandResponse(data.id, false, undefined, String(error));
        }
      }

      if (data.command === 'GET_RECORDING_STATUS') {
        const status = {
          isRecording: this.recordingSession?.isRecording ?? false,
          recordingId: this.recordingSession?.id,
          duration: this.recordingSession
            ? Math.floor((Date.now() - this.recordingSession.startTime) / 1000)
            : 0,
        };
        this.agentService.sendCommandResponse(data.id, true, JSON.stringify(status));
      }
    });
  }

  async startRecording(): Promise<string> {
    if (this.recordingSession?.isRecording) {
      throw new Error('Recording already in progress');
    }

    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get desktop sources
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      // Create hidden window for recording
      this.recorderWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      });

      // Start recording using MediaRecorder in renderer
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Screen Recorder</title></head>
        <body>
          <video id="video" style="display:none"></video>
          <script>
            const { ipcRenderer } = require('electron');

            async function startRecording(sourceId) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: false,
                  video: {
                    mandatory: {
                      chromeMediaSource: 'desktop',
                      chromeMediaSourceId: sourceId,
                      minWidth: 1280,
                      maxWidth: 1920,
                      minHeight: 720,
                      maxHeight: 1080,
                      minFrameRate: 10,
                      maxFrameRate: 15,
                    }
                  }
                });

                const mediaRecorder = new MediaRecorder(stream, {
                  mimeType: 'video/webm;codecs=vp9',
                  videoBitsPerSecond: 1000000, // 1 Mbps
                });

                const chunks = [];

                mediaRecorder.ondataavailable = (e) => {
                  if (e.data.size > 0) {
                    chunks.push(e.data);
                  }
                };

                mediaRecorder.onstop = async () => {
                  const blob = new Blob(chunks, { type: 'video/webm' });
                  const buffer = await blob.arrayBuffer();
                  ipcRenderer.send('recording-complete', Buffer.from(buffer));
                  stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start(1000); // Capture in 1 second chunks
                ipcRenderer.send('recording-started');

                ipcRenderer.on('stop-recording', () => {
                  if (mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                  }
                });

              } catch (error) {
                ipcRenderer.send('recording-error', error.message);
              }
            }

            ipcRenderer.on('start-recording', (_, sourceId) => {
              startRecording(sourceId);
            });
          </script>
        </body>
        </html>
      `;

      await this.recorderWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

      // Set up IPC handlers
      const { ipcMain } = require('electron');

      return new Promise((resolve, reject) => {
        const onStarted = () => {
          this.recordingSession = {
            id: recordingId,
            startTime: Date.now(),
            chunks: [],
            isRecording: true,
          };

          // Notify server that recording started
          this.agentService.sendRecordingStatus(recordingId, 'RECORDING');

          cleanup();
          resolve(recordingId);
        };

        const onError = (_: unknown, error: string) => {
          cleanup();
          reject(new Error(error));
        };

        const cleanup = () => {
          ipcMain.removeListener('recording-started', onStarted);
          ipcMain.removeListener('recording-error', onError);
        };

        ipcMain.once('recording-started', onStarted);
        ipcMain.once('recording-error', onError);

        // Send start command to renderer
        this.recorderWindow?.webContents.send('start-recording', sources[0].id);
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<{ id: string; filePath: string; duration: number; fileSize: number }> {
    if (!this.recordingSession?.isRecording || !this.recorderWindow) {
      throw new Error('No recording in progress');
    }

    const { ipcMain } = require('electron');
    const session = this.recordingSession;

    return new Promise((resolve, reject) => {
      const onComplete = async (_: unknown, buffer: Buffer) => {
        try {
          // Calculate duration
          const duration = Math.floor((Date.now() - session.startTime) / 1000);

          // Save to file
          const fileName = `${session.id}.webm`;
          const filePath = path.join(this.recordingsDir, fileName);
          fs.writeFileSync(filePath, buffer);

          const fileSize = buffer.length;

          // Clean up
          this.recorderWindow?.close();
          this.recorderWindow = null;
          this.recordingSession = null;

          // Notify server that recording completed
          this.agentService.sendRecordingComplete(session.id, filePath, duration, fileSize);

          // Upload recording to server (in background)
          this.uploadRecording(session.id, filePath, buffer).catch(console.error);

          cleanup();
          resolve({ id: session.id, filePath, duration, fileSize });
        } catch (error) {
          cleanup();
          reject(error);
        }
      };

      const cleanup = () => {
        ipcMain.removeListener('recording-complete', onComplete);
      };

      ipcMain.once('recording-complete', onComplete);

      // Send stop command to renderer
      this.recorderWindow?.webContents.send('stop-recording');

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.recordingSession?.isRecording) {
          cleanup();
          reject(new Error('Recording stop timed out'));
        }
      }, 10000);
    });
  }

  private async uploadRecording(recordingId: string, filePath: string, buffer: Buffer): Promise<void> {
    try {
      // Convert to base64 and send in chunks (for large files)
      const base64Data = buffer.toString('base64');
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(base64Data.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = base64Data.slice(i * chunkSize, (i + 1) * chunkSize);
        this.agentService.sendRecordingChunk(recordingId, chunk, i, totalChunks);
        // Small delay between chunks to avoid overwhelming the socket
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Recording ${recordingId} uploaded successfully`);
    } catch (error) {
      console.error('Failed to upload recording:', error);
    }
  }

  isRecording(): boolean {
    return this.recordingSession?.isRecording ?? false;
  }

  getCurrentRecordingId(): string | null {
    return this.recordingSession?.id ?? null;
  }

  getRecordingsDir(): string {
    return this.recordingsDir;
  }

  // Clean up old recordings (older than 7 days)
  cleanupOldRecordings(): void {
    try {
      const files = fs.readdirSync(this.recordingsDir);
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.recordingsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtimeMs < weekAgo) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old recording: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old recordings:', error);
    }
  }
}
