import psList from 'ps-list';
import * as si from 'systeminformation';
import { AgentService } from './agent-service';

interface ProcessInfo {
  processName: string;
  processId: number;
  path: string;
  cpuUsage: number;
  memoryUsage: number;
  username: string;
  startedAt?: number;
}

export class ProcessMonitor {
  private agentService: AgentService;
  private monitorInterval: NodeJS.Timeout | null = null;
  private lastProcessList: Map<number, ProcessInfo> = new Map();

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  start(): void {
    // Monitor processes every 10 seconds
    this.monitorInterval = setInterval(async () => {
      await this.collectAndSendProcesses();
    }, 10000);

    // Initial collection
    this.collectAndSendProcesses();

    console.log('Process monitor service started');
  }

  stop(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    console.log('Process monitor service stopped');
  }

  private async collectAndSendProcesses(): Promise<void> {
    try {
      const [processes, cpuProcesses] = await Promise.all([
        psList(),
        si.processes(),
      ]);

      // Create a map of PID to CPU usage
      const cpuMap = new Map<number, number>();
      const memMap = new Map<number, number>();

      for (const proc of cpuProcesses.list) {
        cpuMap.set(proc.pid, proc.cpu || 0);
        memMap.set(proc.pid, proc.mem || 0);
      }

      const processInfos: ProcessInfo[] = processes
        .filter(p => p.name) // Filter out empty process names
        .map(p => ({
          processName: p.name,
          processId: p.pid,
          path: p.cmd || '',
          cpuUsage: cpuMap.get(p.pid) || 0,
          memoryUsage: memMap.get(p.pid) || 0,
          username: p.name, // ps-list doesn't provide username directly
        }));

      // Update cache
      this.lastProcessList.clear();
      for (const proc of processInfos) {
        this.lastProcessList.set(proc.processId, proc);
      }

      // Send to server
      this.agentService.sendProcessList(processInfos);
    } catch (error) {
      console.error('Failed to collect processes:', error);
    }
  }

  getProcessList(): ProcessInfo[] {
    return Array.from(this.lastProcessList.values());
  }

  async killProcess(pid: number): Promise<boolean> {
    try {
      process.kill(pid);
      return true;
    } catch (error) {
      console.error(`Failed to kill process ${pid}:`, error);
      return false;
    }
  }
}
