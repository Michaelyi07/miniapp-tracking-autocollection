/**
 * Shared types for the tracking auto-collection module.
 * Mini-program globals are declared loosely; tests provide mocks.
 */

export interface TrkEvent {
  event: string;
  props: Record<string, unknown>;
  ts: number;
}

export interface TrkConfig {
  /** master switch for automatic events (app_launch / page_view / share); manual track() is unaffected */
  autoCollect?: boolean;
  /** query keys allowed into event props; anything else is dropped. default: ["id", "from"] */
  whitelist?: string[];
  /** optional sink; default keeps events in an internal buffer (stub transport) */
  onEvent?: (e: TrkEvent) => void;
}

export interface AppLaunchProps {
  scene: string | number | null;
  cold_start: boolean;
}

export interface PageViewProps {
  route: string;
  prev_route: string | null;
  /** whitelisted query entries only; empty values omitted */
  [key: string]: unknown;
}

export interface ShareProps {
  page: string;
  target_type: string | null;
  target_id: string | null;
}

/* Minimal ambient shapes for the mini-program runtime (stub-compatible). */
export interface LaunchOptions {
  path?: string;
  scene?: number | string;
  query?: Record<string, string>;
  [key: string]: unknown;
}

export interface PageInstance {
  route?: string;
  options?: Record<string, string>;
  [key: string]: unknown;
}

export type AnyFn = (...args: any[]) => any;
