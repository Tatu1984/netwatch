import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { dialog, BrowserWindow } from 'electron';
import { AgentService } from './agent-service';
import { ProcessMonitor } from './process-monitor';

const execAsync = promisify(exec);

interface CommandPayload {
  message?: string;
  title?: string;
  command?: string;
  processId?: number;
  processName?: string;
}

export class CommandExecutor {
  private agentService: AgentService;
  private processMonitor?: ProcessMonitor;
  private inputBlocked = false;

  constructor(agentService: AgentService, processMonitor?: ProcessMonitor) {
    this.agentService = agentService;
    this.processMonitor = processMonitor;
  }

  registerHandlers(): void {
    this.agentService.on('command', async (data: { id: string; command: string; payload?: CommandPayload }) => {
      await this.executeCommand(data.id, data.command, data.payload);
    });

    console.log('Command executor registered');
  }

  private async executeCommand(commandId: string, command: string, payload?: CommandPayload): Promise<void> {
    console.log(`Executing command: ${command}`);

    try {
      let success = true;
      let response = '';

      switch (command) {
        case 'LOCK':
          await this.lockScreen();
          response = 'Screen locked';
          break;

        case 'UNLOCK':
          // Unlock is typically not possible remotely for security reasons
          response = 'Unlock command received (requires user interaction)';
          break;

        case 'SHUTDOWN':
          await this.shutdown();
          response = 'Shutdown initiated';
          break;

        case 'RESTART':
          await this.restart();
          response = 'Restart initiated';
          break;

        case 'LOGOFF':
          await this.logoff();
          response = 'Logoff initiated';
          break;

        case 'SLEEP':
          await this.sleep();
          response = 'Sleep initiated';
          break;

        case 'MESSAGE':
          if (payload?.message) {
            await this.showMessage(payload.title || 'Message', payload.message);
            response = 'Message displayed';
          } else {
            success = false;
            response = 'No message provided';
          }
          break;

        case 'EXECUTE':
          if (payload?.command) {
            response = await this.executeSystemCommand(payload.command);
          } else {
            success = false;
            response = 'No command provided';
          }
          break;

        case 'KILL_PROCESS':
          if (payload?.processId) {
            const killed = await this.killProcess(payload.processId);
            if (killed) {
              response = `Process ${payload.processId} terminated`;
            } else {
              success = false;
              response = `Failed to terminate process ${payload.processId}`;
            }
          } else {
            success = false;
            response = 'No process ID provided';
          }
          break;

        case 'BLOCK_INPUT':
          this.blockInput(true);
          response = 'Input blocked';
          break;

        case 'UNBLOCK_INPUT':
          this.blockInput(false);
          response = 'Input unblocked';
          break;

        default:
          success = false;
          response = `Unknown command: ${command}`;
      }

      this.agentService.sendCommandResponse(commandId, success, response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Command execution failed: ${errorMessage}`);
      this.agentService.sendCommandResponse(commandId, false, undefined, errorMessage);
    }
  }

  private async lockScreen(): Promise<void> {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        await execAsync('rundll32.exe user32.dll,LockWorkStation');
        break;

      case 'darwin':
        await execAsync('/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend');
        break;

      case 'linux':
        // Try different lock commands
        try {
          await execAsync('gnome-screensaver-command -l');
        } catch {
          try {
            await execAsync('xdg-screensaver lock');
          } catch {
            await execAsync('loginctl lock-session');
          }
        }
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async shutdown(): Promise<void> {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        await execAsync('shutdown /s /t 30 /c "Remote shutdown initiated"');
        break;

      case 'darwin':
        await execAsync('osascript -e \'tell app "System Events" to shut down\'');
        break;

      case 'linux':
        await execAsync('shutdown -h +1 "Remote shutdown initiated"');
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async restart(): Promise<void> {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        await execAsync('shutdown /r /t 30 /c "Remote restart initiated"');
        break;

      case 'darwin':
        await execAsync('osascript -e \'tell app "System Events" to restart\'');
        break;

      case 'linux':
        await execAsync('shutdown -r +1 "Remote restart initiated"');
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async logoff(): Promise<void> {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        await execAsync('shutdown /l');
        break;

      case 'darwin':
        await execAsync('osascript -e \'tell app "System Events" to log out\'');
        break;

      case 'linux':
        await execAsync('gnome-session-quit --logout --no-prompt');
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async sleep(): Promise<void> {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        await execAsync('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
        break;

      case 'darwin':
        await execAsync('pmset sleepnow');
        break;

      case 'linux':
        await execAsync('systemctl suspend');
        break;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async showMessage(title: string, message: string): Promise<void> {
    // Create a message window
    const msgWindow = new BrowserWindow({
      width: 400,
      height: 200,
      frame: true,
      alwaysOnTop: true,
      resizable: false,
      modal: true,
      show: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 20px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f0f0f0;
            }
            h2 { margin: 0 0 15px 0; color: #333; }
            p { margin: 0 0 20px 0; color: #666; }
            button {
              background: #007bff;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              align-self: flex-end;
            }
            button:hover { background: #0056b3; }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          <p>${message}</p>
          <button onclick="window.close()">OK</button>
        </body>
      </html>
    `;

    msgWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  private async executeSystemCommand(command: string): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      return stdout || stderr || 'Command executed successfully';
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; message?: string };
      return err.stderr || err.stdout || err.message || 'Command failed';
    }
  }

  private async killProcess(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch (error) {
      // Try force kill
      try {
        process.kill(pid, 'SIGKILL');
        return true;
      } catch {
        return false;
      }
    }
  }

  private blockInput(block: boolean): void {
    // Note: Blocking input requires platform-specific implementation
    // This is a simplified version
    this.inputBlocked = block;

    if (os.platform() === 'win32') {
      // On Windows, we would use BlockInput API via ffi
      // This requires additional native modules
      console.log(block ? 'Input blocking enabled (Windows)' : 'Input blocking disabled (Windows)');
    } else {
      console.log('Input blocking not fully supported on this platform');
    }
  }

  isInputBlocked(): boolean {
    return this.inputBlocked;
  }
}
