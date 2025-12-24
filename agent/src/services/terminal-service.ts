import * as os from 'os';
import { AgentService } from './agent-service';

// Note: node-pty requires native compilation
// We'll use child_process spawn as a fallback

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

interface TerminalSession {
  sessionId: string;
  process: ChildProcessWithoutNullStreams;
  shell: string;
}

export class TerminalService {
  private agentService: AgentService;
  private sessions: Map<string, TerminalSession> = new Map();

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  registerHandlers(): void {
    this.agentService.on('start_terminal', (data: { sessionId: string; shell?: string }) => {
      this.startSession(data.sessionId, data.shell);
    });

    this.agentService.on('terminal_input', (data: { sessionId: string; input: string }) => {
      this.handleInput(data.sessionId, data.input);
    });

    console.log('Terminal service registered');
  }

  private getDefaultShell(): string {
    const platform = os.platform();

    switch (platform) {
      case 'win32':
        return process.env.COMSPEC || 'cmd.exe';
      case 'darwin':
        return process.env.SHELL || '/bin/zsh';
      default:
        return process.env.SHELL || '/bin/bash';
    }
  }

  private startSession(sessionId: string, requestedShell?: string): void {
    const shell = requestedShell || this.getDefaultShell();

    console.log(`Starting terminal session ${sessionId} with shell: ${shell}`);

    try {
      const platform = os.platform();
      let termProcess: ChildProcessWithoutNullStreams;

      if (platform === 'win32') {
        // Windows - use cmd or powershell
        termProcess = spawn(shell, [], {
          shell: true,
          env: process.env,
        });
      } else {
        // Unix-like - use interactive shell
        termProcess = spawn(shell, ['-i'], {
          shell: false,
          env: {
            ...process.env,
            TERM: 'xterm-256color',
          },
        });
      }

      // Handle stdout
      termProcess.stdout.on('data', (data: Buffer) => {
        this.agentService.sendTerminalOutput(sessionId, data.toString());
      });

      // Handle stderr
      termProcess.stderr.on('data', (data: Buffer) => {
        this.agentService.sendTerminalOutput(sessionId, data.toString());
      });

      // Handle exit
      termProcess.on('exit', (code) => {
        console.log(`Terminal session ${sessionId} exited with code ${code}`);
        this.sessions.delete(sessionId);
        this.agentService.sendTerminalOutput(sessionId, `\r\n[Session ended with code ${code}]\r\n`);
      });

      // Handle errors
      termProcess.on('error', (error) => {
        console.error(`Terminal session ${sessionId} error:`, error);
        this.agentService.sendTerminalOutput(sessionId, `\r\n[Error: ${error.message}]\r\n`);
      });

      // Store session
      this.sessions.set(sessionId, {
        sessionId,
        process: termProcess,
        shell,
      });

      // Send initial prompt
      this.agentService.sendTerminalOutput(sessionId, `Connected to ${shell}\r\n`);

    } catch (error) {
      console.error(`Failed to start terminal session ${sessionId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.agentService.sendTerminalOutput(sessionId, `\r\n[Failed to start shell: ${errorMessage}]\r\n`);
    }
  }

  private handleInput(sessionId: string, input: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      console.warn(`Terminal session ${sessionId} not found`);
      return;
    }

    try {
      session.process.stdin.write(input);
    } catch (error) {
      console.error(`Failed to write to terminal ${sessionId}:`, error);
    }
  }

  stopSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session) {
      try {
        session.process.kill();
      } catch (error) {
        console.error(`Failed to kill terminal session ${sessionId}:`, error);
      }
      this.sessions.delete(sessionId);
    }
  }

  stopAll(): void {
    for (const [sessionId] of this.sessions) {
      this.stopSession(sessionId);
    }
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }
}
