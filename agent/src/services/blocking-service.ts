import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { AgentService } from './agent-service';

const execAsync = promisify(exec);

interface BlockingRule {
  id: string;
  type: 'website' | 'application';
  pattern: string;
  mode: 'block' | 'allow';
  active: boolean;
}

export class BlockingService {
  private agentService: AgentService;
  private websiteRules: BlockingRule[] = [];
  private applicationRules: BlockingRule[] = [];
  private hostsBackup: string | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  start(): void {
    // Monitor for blocked applications every 2 seconds
    this.monitorInterval = setInterval(async () => {
      await this.enforceApplicationBlocking();
    }, 2000);

    console.log('Blocking service started');
  }

  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // Restore hosts file
    this.restoreHostsFile();

    console.log('Blocking service stopped');
  }

  // Website blocking via hosts file
  async blockWebsite(domain: string): Promise<boolean> {
    try {
      const platform = os.platform();
      let hostsPath: string;

      if (platform === 'win32') {
        hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
      } else {
        hostsPath = '/etc/hosts';
      }

      // Backup original hosts file if not already done
      if (!this.hostsBackup) {
        this.hostsBackup = fs.readFileSync(hostsPath, 'utf-8');
      }

      // Read current hosts file
      let hostsContent = fs.readFileSync(hostsPath, 'utf-8');

      // Add blocking entry if not exists
      const blockEntry = `127.0.0.1 ${domain}`;
      const wwwBlockEntry = `127.0.0.1 www.${domain}`;

      if (!hostsContent.includes(blockEntry)) {
        hostsContent += `\n# NetWatch Block\n${blockEntry}\n${wwwBlockEntry}`;

        // Write back (requires admin privileges)
        if (platform === 'win32') {
          // Windows - use PowerShell with elevation
          const escapedContent = hostsContent.replace(/"/g, '`"').replace(/\n/g, '`n');
          await execAsync(`powershell -Command "Set-Content -Path '${hostsPath}' -Value '${escapedContent}' -Encoding ASCII"`);
        } else {
          // Unix - use sudo (may prompt for password)
          const tempFile = path.join(os.tmpdir(), 'hosts.tmp');
          fs.writeFileSync(tempFile, hostsContent);
          await execAsync(`sudo cp ${tempFile} ${hostsPath}`);
          fs.unlinkSync(tempFile);
        }
      }

      // Add to rules
      this.websiteRules.push({
        id: `web-${Date.now()}`,
        type: 'website',
        pattern: domain,
        mode: 'block',
        active: true,
      });

      // Flush DNS cache
      await this.flushDNSCache();

      return true;
    } catch (error) {
      console.error(`Failed to block website ${domain}:`, error);
      return false;
    }
  }

  async unblockWebsite(domain: string): Promise<boolean> {
    try {
      const platform = os.platform();
      let hostsPath: string;

      if (platform === 'win32') {
        hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
      } else {
        hostsPath = '/etc/hosts';
      }

      let hostsContent = fs.readFileSync(hostsPath, 'utf-8');

      // Remove blocking entries
      const lines = hostsContent.split('\n').filter(line => {
        return !line.includes(domain) || !line.startsWith('127.0.0.1');
      });

      hostsContent = lines.join('\n');

      // Write back
      if (platform === 'win32') {
        const escapedContent = hostsContent.replace(/"/g, '`"').replace(/\n/g, '`n');
        await execAsync(`powershell -Command "Set-Content -Path '${hostsPath}' -Value '${escapedContent}' -Encoding ASCII"`);
      } else {
        const tempFile = path.join(os.tmpdir(), 'hosts.tmp');
        fs.writeFileSync(tempFile, hostsContent);
        await execAsync(`sudo cp ${tempFile} ${hostsPath}`);
        fs.unlinkSync(tempFile);
      }

      // Remove from rules
      this.websiteRules = this.websiteRules.filter(r => r.pattern !== domain);

      // Flush DNS cache
      await this.flushDNSCache();

      return true;
    } catch (error) {
      console.error(`Failed to unblock website ${domain}:`, error);
      return false;
    }
  }

  private async flushDNSCache(): Promise<void> {
    const platform = os.platform();

    try {
      if (platform === 'win32') {
        await execAsync('ipconfig /flushdns');
      } else if (platform === 'darwin') {
        await execAsync('sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder');
      } else {
        await execAsync('sudo systemd-resolve --flush-caches');
      }
    } catch (error) {
      console.error('Failed to flush DNS cache:', error);
    }
  }

  private restoreHostsFile(): void {
    if (!this.hostsBackup) return;

    try {
      const platform = os.platform();
      let hostsPath: string;

      if (platform === 'win32') {
        hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts';
      } else {
        hostsPath = '/etc/hosts';
      }

      fs.writeFileSync(hostsPath, this.hostsBackup);
      console.log('Hosts file restored');
    } catch (error) {
      console.error('Failed to restore hosts file:', error);
    }
  }

  // Application blocking
  blockApplication(processName: string): void {
    this.applicationRules.push({
      id: `app-${Date.now()}`,
      type: 'application',
      pattern: processName.toLowerCase(),
      mode: 'block',
      active: true,
    });

    console.log(`Application blocked: ${processName}`);
  }

  unblockApplication(processName: string): void {
    this.applicationRules = this.applicationRules.filter(
      r => r.pattern !== processName.toLowerCase()
    );

    console.log(`Application unblocked: ${processName}`);
  }

  private async enforceApplicationBlocking(): Promise<void> {
    if (this.applicationRules.length === 0) return;

    try {
      const psList = await import('ps-list');
      const processes = await psList.default();

      for (const proc of processes) {
        const procName = proc.name.toLowerCase();

        for (const rule of this.applicationRules) {
          if (rule.active && rule.mode === 'block' && procName.includes(rule.pattern)) {
            // Kill the process
            try {
              process.kill(proc.pid, 'SIGTERM');
              console.log(`Blocked application terminated: ${proc.name} (PID: ${proc.pid})`);
            } catch (error) {
              // Process may have already exited
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to enforce application blocking:', error);
    }
  }

  // Set rules from server
  setRules(rules: BlockingRule[]): void {
    this.websiteRules = rules.filter(r => r.type === 'website');
    this.applicationRules = rules.filter(r => r.type === 'application');

    // Apply website rules
    for (const rule of this.websiteRules) {
      if (rule.active && rule.mode === 'block') {
        this.blockWebsite(rule.pattern);
      }
    }
  }

  getRules(): BlockingRule[] {
    return [...this.websiteRules, ...this.applicationRules];
  }
}
