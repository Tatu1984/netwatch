declare module 'node-global-key-listener' {
  export interface IGlobalKeyEvent {
    name?: string;
    state: 'DOWN' | 'UP';
    rawKey?: {
      _nameRaw: string;
    };
  }

  export type IGlobalKeyListener = (event: IGlobalKeyEvent) => void;

  export class GlobalKeyboardListener {
    constructor();
    addListener(callback: IGlobalKeyListener): void;
    removeListener(callback: IGlobalKeyListener): void;
    kill(): void;
  }
}
