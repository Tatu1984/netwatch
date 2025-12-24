import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { AgentService } from './agent-service';

const execAsync = promisify(exec);

interface RestrictionSettings {
  disableTaskManager: boolean;
  disableCommandPrompt: boolean;
  disableControlPanel: boolean;
  disableUSB: boolean;
  disablePrinting: boolean;
  disableRegistryEditor: boolean;
}

export class SystemRestrictions {
  private agentService: AgentService;
  private currentSettings: RestrictionSettings = {
    disableTaskManager: false,
    disableCommandPrompt: false,
    disableControlPanel: false,
    disableUSB: false,
    disablePrinting: false,
    disableRegistryEditor: false,
  };

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  async applyRestrictions(settings: Partial<RestrictionSettings>): Promise<void> {
    const platform = os.platform();

    if (platform === 'win32') {
      await this.applyWindowsRestrictions(settings);
    } else if (platform === 'darwin') {
      await this.applyMacRestrictions(settings);
    } else {
      await this.applyLinuxRestrictions(settings);
    }

    this.currentSettings = { ...this.currentSettings, ...settings };
  }

  private async applyWindowsRestrictions(settings: Partial<RestrictionSettings>): Promise<void> {
    try {
      // Disable Task Manager
      if (settings.disableTaskManager !== undefined) {
        const value = settings.disableTaskManager ? '1' : '0';
        await execAsync(
          `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableTaskMgr /t REG_DWORD /d ${value} /f`
        );
      }

      // Disable Command Prompt
      if (settings.disableCommandPrompt !== undefined) {
        const value = settings.disableCommandPrompt ? '1' : '0';
        await execAsync(
          `reg add "HKCU\\Software\\Policies\\Microsoft\\Windows\\System" /v DisableCMD /t REG_DWORD /d ${value} /f`
        );
      }

      // Disable Control Panel
      if (settings.disableControlPanel !== undefined) {
        const value = settings.disableControlPanel ? '1' : '0';
        await execAsync(
          `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer" /v NoControlPanel /t REG_DWORD /d ${value} /f`
        );
      }

      // Disable Registry Editor
      if (settings.disableRegistryEditor !== undefined) {
        const value = settings.disableRegistryEditor ? '1' : '0';
        await execAsync(
          `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" /v DisableRegistryTools /t REG_DWORD /d ${value} /f`
        );
      }

      // Disable USB Storage
      if (settings.disableUSB !== undefined) {
        const value = settings.disableUSB ? '4' : '3'; // 4 = Disabled, 3 = Enabled
        await execAsync(
          `reg add "HKLM\\SYSTEM\\CurrentControlSet\\Services\\USBSTOR" /v Start /t REG_DWORD /d ${value} /f`
        );
      }

      // Disable Printing (requires admin)
      if (settings.disablePrinting !== undefined) {
        if (settings.disablePrinting) {
          await execAsync('net stop spooler');
        } else {
          await execAsync('net start spooler');
        }
      }

      console.log('Windows restrictions applied successfully');
    } catch (error) {
      console.error('Error applying Windows restrictions:', error);
    }
  }

  private async applyMacRestrictions(settings: Partial<RestrictionSettings>): Promise<void> {
    try {
      // macOS uses different mechanisms - primarily MDM profiles
      // For basic restrictions, we can use defaults and launchctl

      // Disable USB Storage
      if (settings.disableUSB !== undefined) {
        if (settings.disableUSB) {
          // Unload USB storage kernel extension
          await execAsync('sudo kextunload /System/Library/Extensions/IOUSBMassStorageClass.kext').catch(() => {});
        } else {
          await execAsync('sudo kextload /System/Library/Extensions/IOUSBMassStorageClass.kext').catch(() => {});
        }
      }

      // Disable Printing
      if (settings.disablePrinting !== undefined) {
        if (settings.disablePrinting) {
          await execAsync('sudo launchctl unload /System/Library/LaunchDaemons/org.cups.cupsd.plist').catch(() => {});
        } else {
          await execAsync('sudo launchctl load /System/Library/LaunchDaemons/org.cups.cupsd.plist').catch(() => {});
        }
      }

      console.log('macOS restrictions applied');
    } catch (error) {
      console.error('Error applying macOS restrictions:', error);
    }
  }

  private async applyLinuxRestrictions(settings: Partial<RestrictionSettings>): Promise<void> {
    try {
      // Disable USB Storage
      if (settings.disableUSB !== undefined) {
        if (settings.disableUSB) {
          await execAsync('sudo modprobe -r usb_storage').catch(() => {});
          // Add to blacklist
          await execAsync('echo "blacklist usb_storage" | sudo tee /etc/modprobe.d/disable-usb-storage.conf').catch(() => {});
        } else {
          await execAsync('sudo modprobe usb_storage').catch(() => {});
          await execAsync('sudo rm -f /etc/modprobe.d/disable-usb-storage.conf').catch(() => {});
        }
      }

      // Disable Printing
      if (settings.disablePrinting !== undefined) {
        if (settings.disablePrinting) {
          await execAsync('sudo systemctl stop cups').catch(() => {});
          await execAsync('sudo systemctl disable cups').catch(() => {});
        } else {
          await execAsync('sudo systemctl enable cups').catch(() => {});
          await execAsync('sudo systemctl start cups').catch(() => {});
        }
      }

      console.log('Linux restrictions applied');
    } catch (error) {
      console.error('Error applying Linux restrictions:', error);
    }
  }

  async removeAllRestrictions(): Promise<void> {
    await this.applyRestrictions({
      disableTaskManager: false,
      disableCommandPrompt: false,
      disableControlPanel: false,
      disableUSB: false,
      disablePrinting: false,
      disableRegistryEditor: false,
    });
  }

  getSettings(): RestrictionSettings {
    return { ...this.currentSettings };
  }

  registerHandlers(): void {
    this.agentService.on('command', async (data: { id: string; command: string; payload?: Record<string, unknown> }) => {
      if (data.command === 'SET_RESTRICTIONS') {
        try {
          const settings = data.payload as Partial<RestrictionSettings>;
          await this.applyRestrictions(settings);
          this.agentService.sendCommandResponse(data.id, true, 'Restrictions applied');
        } catch (error) {
          this.agentService.sendCommandResponse(data.id, false, undefined, String(error));
        }
      }

      if (data.command === 'GET_RESTRICTIONS') {
        this.agentService.sendCommandResponse(data.id, true, JSON.stringify(this.getSettings()));
      }

      if (data.command === 'REMOVE_RESTRICTIONS') {
        try {
          await this.removeAllRestrictions();
          this.agentService.sendCommandResponse(data.id, true, 'All restrictions removed');
        } catch (error) {
          this.agentService.sendCommandResponse(data.id, false, undefined, String(error));
        }
      }
    });
  }
}
