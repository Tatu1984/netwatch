import screenshot from 'screenshot-desktop';
import { AgentService } from './agent-service';

export class ScreenCapture {
  private agentService: AgentService;
  private captureInterval: NodeJS.Timeout | null = null;
  private streamInterval: NodeJS.Timeout | null = null;
  private isStreaming = false;
  private streamQuality = 60;
  private streamFps = 5;

  constructor(agentService: AgentService) {
    this.agentService = agentService;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle stream start request
    this.agentService.on('start_screen_stream', (data: { quality: number; fps: number }) => {
      this.startStream(data.quality, data.fps);
    });

    // Handle stream stop request
    this.agentService.on('stop_screen_stream', () => {
      this.stopStream();
    });

    // Handle single screenshot request
    this.agentService.on('capture_screenshot', async () => {
      await this.captureAndSendScreenshot();
    });

    // Handle remote control session start (higher quality/fps)
    this.agentService.on('start_remote_control', (data: { quality: number; fps: number }) => {
      this.startStream(data.quality, data.fps);
    });
  }

  start(): void {
    // Start periodic screenshot capture for storage
    const config = this.agentService.getConfig();
    this.captureInterval = setInterval(async () => {
      await this.captureAndSendScreenshot();
    }, config.screenshotInterval);

    console.log('Screen capture service started');
  }

  stop(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.stopStream();
    console.log('Screen capture service stopped');
  }

  private startStream(quality: number, fps: number): void {
    if (this.isStreaming) {
      this.stopStream();
    }

    this.isStreaming = true;
    this.streamQuality = quality;
    this.streamFps = fps;

    const intervalMs = Math.floor(1000 / fps);

    this.streamInterval = setInterval(async () => {
      await this.captureAndStreamFrame();
    }, intervalMs);

    console.log(`Screen streaming started: ${fps} fps, ${quality}% quality`);
  }

  private stopStream(): void {
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
    this.isStreaming = false;
    console.log('Screen streaming stopped');
  }

  private async captureAndStreamFrame(): Promise<void> {
    try {
      const displays = await screenshot.listDisplays();

      // Capture each display
      for (let i = 0; i < displays.length; i++) {
        const imgBuffer = await screenshot({
          screen: displays[i].id,
          format: 'jpg',
        });

        // Convert to base64
        const base64Image = imgBuffer.toString('base64');

        // Send frame
        this.agentService.sendScreenFrame(base64Image, i);
      }
    } catch (error) {
      console.error('Failed to capture screen frame:', error);
    }
  }

  private async captureAndSendScreenshot(): Promise<void> {
    try {
      // Get active window info (would need active-win integration)
      let activeWindow = 'Desktop';
      try {
        const activeWin = await import('active-win');
        const win = await activeWin.default();
        activeWindow = win?.title || 'Desktop';
      } catch {
        // active-win may not be available
      }

      const imgBuffer = await screenshot({ format: 'jpg' });
      const base64Image = imgBuffer.toString('base64');

      this.agentService.sendScreenshot(base64Image, activeWindow);
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    }
  }

  // Capture all monitors
  async captureAllMonitors(): Promise<Array<{ monitorIndex: number; image: string }>> {
    try {
      const displays = await screenshot.listDisplays();
      const captures: Array<{ monitorIndex: number; image: string }> = [];

      for (let i = 0; i < displays.length; i++) {
        const imgBuffer = await screenshot({ screen: displays[i].id, format: 'jpg' });
        captures.push({
          monitorIndex: i,
          image: imgBuffer.toString('base64'),
        });
      }

      return captures;
    } catch (error) {
      console.error('Failed to capture all monitors:', error);
      return [];
    }
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }
}
