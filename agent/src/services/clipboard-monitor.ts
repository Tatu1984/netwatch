import { AgentService } from './agent-service';

export class ClipboardMonitor {
  private agentService: AgentService;
  private monitorInterval: NodeJS.Timeout | null = null;
  private lastClipboardContent = '';

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  start(): void {
    // Check clipboard every 2 seconds
    this.monitorInterval = setInterval(async () => {
      await this.checkClipboard();
    }, 2000);

    console.log('Clipboard monitor service started');
  }

  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('Clipboard monitor service stopped');
  }

  private async checkClipboard(): Promise<void> {
    try {
      const clipboardy = await import('clipboardy');
      const content = await clipboardy.default.read();

      // Check if content changed
      if (content && content !== this.lastClipboardContent) {
        this.lastClipboardContent = content;

        // Determine content type
        let contentType = 'TEXT';

        // Check if it's a file path
        if (content.startsWith('/') || content.match(/^[A-Z]:\\/)) {
          contentType = 'FILE';
        }

        // Check if it looks like an image (data URL)
        if (content.startsWith('data:image')) {
          contentType = 'IMAGE';
        }

        // Send to server (truncate if too long)
        const truncatedContent = content.length > 10000
          ? content.substring(0, 10000) + '...[TRUNCATED]'
          : content;

        this.agentService.sendClipboard(truncatedContent, contentType);
      }
    } catch (error) {
      // Clipboard may not be accessible
    }
  }
}
