/**
 * Ambient declarations for the WeChat mini-program runtime globals.
 * The SDK core reads them off globalThis (so tests can inject mocks);
 * application code (sample/) uses these ambient globals directly.
 */
declare function App(options: Record<string, any>): void;
declare function Page(options: Record<string, any>): void;
declare function Component(options: Record<string, any>): void;
declare function getCurrentPages(): Array<Record<string, any>>;
declare const wx: Record<string, any>;
declare const console: {
  log: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
};
