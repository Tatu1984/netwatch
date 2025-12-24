import { AgentService } from './agent-service';

interface ActivityEntry {
  applicationName: string;
  windowTitle: string;
  startTime: number;
  endTime: number;
  duration: number;
  category?: string;
}

// Application categories
const appCategories: Record<string, string> = {
  // Browsers
  'chrome': 'BROWSER',
  'firefox': 'BROWSER',
  'safari': 'BROWSER',
  'edge': 'BROWSER',
  'opera': 'BROWSER',
  'brave': 'BROWSER',

  // Communication
  'slack': 'COMMUNICATION',
  'teams': 'COMMUNICATION',
  'zoom': 'COMMUNICATION',
  'discord': 'COMMUNICATION',
  'skype': 'COMMUNICATION',
  'outlook': 'COMMUNICATION',
  'mail': 'COMMUNICATION',
  'thunderbird': 'COMMUNICATION',

  // Productivity
  'word': 'PRODUCTIVITY',
  'excel': 'PRODUCTIVITY',
  'powerpoint': 'PRODUCTIVITY',
  'pages': 'PRODUCTIVITY',
  'numbers': 'PRODUCTIVITY',
  'keynote': 'PRODUCTIVITY',
  'notion': 'PRODUCTIVITY',
  'evernote': 'PRODUCTIVITY',
  'onenote': 'PRODUCTIVITY',

  // Development
  'code': 'DEVELOPMENT',
  'vscode': 'DEVELOPMENT',
  'visual studio': 'DEVELOPMENT',
  'intellij': 'DEVELOPMENT',
  'pycharm': 'DEVELOPMENT',
  'webstorm': 'DEVELOPMENT',
  'xcode': 'DEVELOPMENT',
  'android studio': 'DEVELOPMENT',
  'sublime': 'DEVELOPMENT',
  'atom': 'DEVELOPMENT',
  'terminal': 'DEVELOPMENT',
  'iterm': 'DEVELOPMENT',
  'powershell': 'DEVELOPMENT',
  'cmd': 'DEVELOPMENT',

  // Entertainment
  'spotify': 'ENTERTAINMENT',
  'netflix': 'ENTERTAINMENT',
  'youtube': 'ENTERTAINMENT',
  'vlc': 'ENTERTAINMENT',
  'music': 'ENTERTAINMENT',

  // Social
  'facebook': 'SOCIAL',
  'twitter': 'SOCIAL',
  'instagram': 'SOCIAL',
  'linkedin': 'SOCIAL',
  'reddit': 'SOCIAL',

  // File Management
  'finder': 'FILE_MANAGEMENT',
  'explorer': 'FILE_MANAGEMENT',
  'files': 'FILE_MANAGEMENT',

  // System
  'settings': 'SYSTEM',
  'control panel': 'SYSTEM',
  'system preferences': 'SYSTEM',
};

export class ActivityTracker {
  private agentService: AgentService;
  private currentActivity: ActivityEntry | null = null;
  private activityBuffer: ActivityEntry[] = [];
  private trackInterval: NodeJS.Timeout | null = null;
  private flushInterval: NodeJS.Timeout | null = null;
  private idleThreshold = 60000; // 1 minute
  private lastInputTime = Date.now();

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  start(): void {
    // Track active window every second
    this.trackInterval = setInterval(async () => {
      await this.trackActiveWindow();
    }, 1000);

    // Flush activity buffer every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 30000);

    console.log('Activity tracker service started');
  }

  stop(): void {
    if (this.trackInterval) {
      clearInterval(this.trackInterval);
      this.trackInterval = null;
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush remaining buffer
    this.commitCurrentActivity();
    this.flushBuffer();

    console.log('Activity tracker service stopped');
  }

  private async trackActiveWindow(): Promise<void> {
    try {
      const activeWin = await import('active-win');
      const win = await activeWin.default();

      if (!win) return;

      const appName = win.owner?.name || 'Unknown';
      const windowTitle = win.title || 'Unknown';

      // Check if activity changed
      if (
        this.currentActivity &&
        this.currentActivity.applicationName === appName &&
        this.currentActivity.windowTitle === windowTitle
      ) {
        // Same activity, just update end time
        this.currentActivity.endTime = Date.now();
        this.currentActivity.duration = this.currentActivity.endTime - this.currentActivity.startTime;
        return;
      }

      // Activity changed, commit previous and start new
      this.commitCurrentActivity();

      this.currentActivity = {
        applicationName: appName,
        windowTitle: windowTitle,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        category: this.categorizeApp(appName),
      };
    } catch (error) {
      // Silently fail - active-win may not work on all platforms
    }
  }

  private commitCurrentActivity(): void {
    if (this.currentActivity && this.currentActivity.duration > 1000) {
      // Only commit if activity lasted more than 1 second
      this.activityBuffer.push({ ...this.currentActivity });
    }
    this.currentActivity = null;
  }

  private flushBuffer(): void {
    if (this.activityBuffer.length > 0) {
      // Send to server
      this.agentService.sendActivityLogs(this.activityBuffer);

      // Clear buffer
      this.activityBuffer = [];
    }
  }

  private categorizeApp(appName: string): string {
    const lowerName = appName.toLowerCase();

    for (const [keyword, category] of Object.entries(appCategories)) {
      if (lowerName.includes(keyword)) {
        return category;
      }
    }

    return 'OTHER';
  }

  recordInputActivity(): void {
    this.lastInputTime = Date.now();
  }

  isIdle(): boolean {
    return Date.now() - this.lastInputTime > this.idleThreshold;
  }

  getIdleTime(): number {
    return Date.now() - this.lastInputTime;
  }
}
