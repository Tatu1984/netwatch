// Electron app extension for isQuitting flag
declare global {
  namespace Electron {
    interface App {
      isQuitting?: boolean;
    }
  }
}

// Module declarations for packages without type definitions
declare module 'screenshot-desktop' {
  interface Display {
    id: string;
    name: string;
  }

  interface CaptureOptions {
    screen?: string;
    format?: 'png' | 'jpg';
    filename?: string;
  }

  function screenshot(options?: CaptureOptions): Promise<Buffer>;
  namespace screenshot {
    function listDisplays(): Promise<Display[]>;
  }
  export = screenshot;
}

declare module 'clipboardy' {
  export function read(): Promise<string>;
  export function write(text: string): Promise<void>;
  export function readSync(): string;
  export function writeSync(text: string): void;
}

// Note: robotjs is optional - remote control will work without it
// If you need full remote control, install robotjs separately
declare module 'robotjs' {
  export function moveMouse(x: number, y: number): void;
  export function mouseClick(button?: string, double?: boolean): void;
  export function mouseToggle(down?: string, button?: string): void;
  export function scrollMouse(x: number, y: number): void;
  export function keyTap(key: string, modifier?: string | string[]): void;
  export function keyToggle(key: string, down: string, modifier?: string | string[]): void;
  export function typeString(string: string): void;
  export function typeStringDelayed(string: string, cpm: number): void;
  export function getScreenSize(): { width: number; height: number };
  export function getMousePos(): { x: number; y: number };
  export const screen: {
    capture(x?: number, y?: number, width?: number, height?: number): {
      width: number;
      height: number;
      image: Buffer;
      bitmapSize: number;
      colorAt(x: number, y: number): string;
    };
  };
}

export {};
