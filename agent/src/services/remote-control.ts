import { AgentService } from './agent-service';

// Note: For full remote control functionality, you would need robotjs or similar
// This is a basic implementation that can be extended

interface MouseEvent {
  type: 'move' | 'click' | 'scroll' | 'drag';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle';
  clickType?: 'single' | 'double';
  scrollX?: number;
  scrollY?: number;
}

interface KeyboardEvent {
  type: 'keydown' | 'keyup' | 'type';
  key?: string;
  keyCode?: number;
  text?: string;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
}

export class RemoteControl {
  private agentService: AgentService;
  private isActive = false;
  private sessionId: string | null = null;

  constructor(agentService: AgentService) {
    this.agentService = agentService;
  }

  registerHandlers(): void {
    this.agentService.on('start_remote_control', (data: { sessionId: string; mode: string }) => {
      this.startSession(data.sessionId, data.mode);
    });

    this.agentService.on('remote_input', (data: { type: 'mouse' | 'keyboard'; event: MouseEvent | KeyboardEvent }) => {
      if (this.isActive) {
        this.handleInput(data.type, data.event);
      }
    });

    console.log('Remote control registered');
  }

  private startSession(sessionId: string, mode: string): void {
    this.sessionId = sessionId;
    this.isActive = mode === 'CONTROL';

    console.log(`Remote control session started: ${sessionId} (mode: ${mode})`);
  }

  private async handleInput(type: 'mouse' | 'keyboard', event: MouseEvent | KeyboardEvent): Promise<void> {
    try {
      // Try to load robotjs dynamically
      // Note: robotjs requires native compilation and may not be available
      let robot: any = null;

      try {
        // Dynamic require to avoid compile-time errors when robotjs is not installed
        robot = require('robotjs');
      } catch {
        console.warn('robotjs not available for remote control');
        return;
      }

      if (type === 'mouse') {
        await this.handleMouseEvent(robot, event as MouseEvent);
      } else {
        await this.handleKeyboardEvent(robot, event as KeyboardEvent);
      }
    } catch (error) {
      console.error('Failed to handle remote input:', error);
    }
  }

  private async handleMouseEvent(robot: any, event: MouseEvent): Promise<void> {
    switch (event.type) {
      case 'move':
        robot.moveMouse(event.x, event.y);
        break;

      case 'click':
        robot.moveMouse(event.x, event.y);
        const button = event.button || 'left';
        if (event.clickType === 'double') {
          robot.mouseClick(button, true);
        } else {
          robot.mouseClick(button);
        }
        break;

      case 'scroll':
        robot.scrollMouse(event.scrollX || 0, event.scrollY || 0);
        break;

      case 'drag':
        robot.mouseToggle('down');
        robot.moveMouse(event.x, event.y);
        robot.mouseToggle('up');
        break;
    }
  }

  private async handleKeyboardEvent(robot: any, event: KeyboardEvent): Promise<void> {
    const modifiers: string[] = [];

    if (event.modifiers?.ctrl) modifiers.push('control');
    if (event.modifiers?.alt) modifiers.push('alt');
    if (event.modifiers?.shift) modifiers.push('shift');
    if (event.modifiers?.meta) modifiers.push('command');

    switch (event.type) {
      case 'keydown':
        if (event.key) {
          robot.keyToggle(event.key.toLowerCase(), 'down', modifiers);
        }
        break;

      case 'keyup':
        if (event.key) {
          robot.keyToggle(event.key.toLowerCase(), 'up', modifiers);
        }
        break;

      case 'type':
        if (event.text) {
          robot.typeString(event.text);
        }
        break;
    }
  }

  stopSession(): void {
    this.isActive = false;
    this.sessionId = null;
    console.log('Remote control session ended');
  }

  isSessionActive(): boolean {
    return this.isActive;
  }
}

// Type declaration for robotjs is in types.d.ts
