/**
 * Tracking SDK - automatic collection module (app_launch / page_view / share).
 *
 * Integration:
 *   1. Global auto-injection: call init({ autoCollect: true }) at the very top of
 *      app.ts (before App()/Page()/Component() are invoked). The globals App,
 *      Page and Component are wrapped once; originals are preserved and return
 *      values (onShareAppMessage) are passed through.
 *   2. Per-page wrapper: const page = trackPage({ ... }); Page(page);
 *
 * Both methods share the same wrapping functions; a __trk_wrapped__ marker
 * prevents double wrapping / double emission when both are used on one page.
 *
 * init({ autoCollect: false }) skips all patching and gates every automatic
 * emission; manual track() keeps working.
 *
 * Component notes (per official docs):
 *   - Regular components have no onShow; they observe pageLifetimes.show.
 *   - A component-constructed PAGE instance carries `route`; embedded
 *     components do not. page_view is emitted from pageLifetimes.show only
 *     when `route` is defined, so embedded components never double-report.
 */
import { filterQuery, parsePathQuery, DEFAULT_WHITELIST } from "./queryFilter";
import type {
  AnyFn,
  PageInstance,
  PageViewProps,
  ShareProps,
  TrkConfig,
  TrkEvent,
} from "./types";

interface TrkState {
  inited: boolean;
  autoCollect: boolean;
  whitelist: string[];
  launched: boolean; // App.onLaunch seen (cold start happened)
  launchShowSeen: boolean; // the onShow that belongs to the cold-start sequence
  lastRoute: string | null; // candidate prev_route (set on page hide/unload)
  events: TrkEvent[]; // default sink (stub transport)
  onEvent?: (e: TrkEvent) => void;
}

const state: TrkState = {
  inited: false,
  autoCollect: true,
  whitelist: [...DEFAULT_WHITELIST],
  launched: false,
  launchShowSeen: false,
  lastRoute: null,
  events: [],
};

export const WRAP_FLAG = "__trk_wrapped__";

/* ------------------------------------------------------------------ */
/* core                                                                */
/* ------------------------------------------------------------------ */

export function init(config: TrkConfig = {}): void {
  state.inited = true;
  state.autoCollect = config.autoCollect !== false;
  state.whitelist = config.whitelist && config.whitelist.length ? [...config.whitelist] : [...DEFAULT_WHITELIST];
  state.onEvent = config.onEvent;
  if (state.autoCollect) injectGlobals();
}

/** Manual tracking - unaffected by autoCollect. */
export function track(event: string, props: Record<string, unknown> = {}): void {
  emit(event, props);
}

/**
 * Per-page integration: wraps a page options object (onLoad/onShow/onHide/
 * onUnload/onShareAppMessage) and returns it for Page(...). Safe to combine
 * with global auto-injection - the wrap marker prevents double emission.
 */
export function trackPage<T extends Record<string, any>>(options: T): T {
  return wrapPageOptions(options) as T;
}

/** Test/demo access to the default sink. */
export function getEmittedEvents(): TrkEvent[] {
  return [...state.events];
}

/** Reset internal state (used by tests). */
export function __resetForTests(): void {
  state.inited = false;
  state.autoCollect = true;
  state.whitelist = [...DEFAULT_WHITELIST];
  state.launched = false;
  state.launchShowSeen = false;
  state.lastRoute = null;
  state.events = [];
  state.onEvent = undefined;
}

function emit(event: string, props: Record<string, unknown>): void {
  if (!state.inited) return; // events before init are dropped (SDK not configured)
  const e: TrkEvent = { event, props, ts: Date.now() };
  state.events.push(e);
  if (state.onEvent) {
    try {
      state.onEvent(e);
    } catch {
      /* sink errors must never break the host app */
    }
  }
}

function autoEmit(event: string, props: Record<string, unknown>): void {
  if (!state.autoCollect) return; // automatic collection disabled
  emit(event, props);
}

/* ------------------------------------------------------------------ */
/* global injection                                                    */
/* ------------------------------------------------------------------ */

function injectGlobals(): void {
  const g = globalThis as Record<string, any>;
  if (typeof g.App === "function" && !g.App.__trk_patched__) {
    const originalApp = g.App;
    g.App = function (options: Record<string, any> = {}) {
      return originalApp(wrapAppOptions(options));
    };
    g.App.__trk_patched__ = true;
  }
  if (typeof g.Page === "function" && !g.Page.__trk_patched__) {
    const originalPage = g.Page;
    g.Page = function (options: Record<string, any> = {}) {
      return originalPage(wrapPageOptions(options));
    };
    g.Page.__trk_patched__ = true;
  }
  if (typeof g.Component === "function" && !g.Component.__trk_patched__) {
    const originalComponent = g.Component;
    g.Component = function (options: Record<string, any> = {}) {
      return originalComponent(wrapComponentOptions(options));
    };
    g.Component.__trk_patched__ = true;
  }
}

/* ------------------------------------------------------------------ */
/* App wrapping: app_launch                                            */
/* ------------------------------------------------------------------ */

function wrapAppOptions(options: Record<string, any>): Record<string, any> {
  if (options[WRAP_FLAG]) return options;
  const origLaunch: AnyFn | undefined = options.onLaunch;
  const origShow: AnyFn | undefined = options.onShow;

  options.onLaunch = function (this: unknown, launchOptions?: Record<string, any>) {
    state.launched = true;
    state.launchShowSeen = false; // the onShow that follows belongs to the cold start
    autoEmit("app_launch", {
      scene: launchOptions && launchOptions.scene !== undefined ? launchOptions.scene : null,
      cold_start: true,
    });
    return origLaunch ? origLaunch.call(this, launchOptions) : undefined;
  };

  options.onShow = function (this: unknown, showOptions?: Record<string, any>) {
    if (!state.launched) {
      // defensive: show without a seen launch (never happens in production order)
    } else if (!state.launchShowSeen) {
      state.launchShowSeen = true; // cold-start sequence: app_launch already emitted
    } else {
      autoEmit("app_launch", {
        scene: showOptions && showOptions.scene !== undefined ? showOptions.scene : null,
        cold_start: false, // warm re-entry
      });
    }
    return origShow ? origShow.call(this, showOptions) : undefined;
  };

  options[WRAP_FLAG] = true;
  return options;
}

/* ------------------------------------------------------------------ */
/* Page wrapping: page_view + share                                    */
/* ------------------------------------------------------------------ */

function wrapPageOptions(options: Record<string, any>): Record<string, any> {
  if (options[WRAP_FLAG]) return options; // already wrapped (by trackPage or injection)
  const origLoad: AnyFn | undefined = options.onLoad;
  const origShow: AnyFn | undefined = options.onShow;
  const origHide: AnyFn | undefined = options.onHide;
  const origUnload: AnyFn | undefined = options.onUnload;

  options.onLoad = function (this: PageInstance, query?: Record<string, string>) {
    // query reaches the page only here (official semantics); cache for onShow.
    (this as any).__trk_query__ = filterQuery(query, state.whitelist);
    return origLoad ? origLoad.call(this, query) : undefined;
  };

  options.onShow = function (this: PageInstance) {
    emitPageView(this);
    return origShow ? origShow.call(this) : undefined;
  };

  options.onHide = function (this: PageInstance) {
    state.lastRoute = routeOf(this); // candidate prev_route for the next visible page
    return origHide ? origHide.call(this) : undefined;
  };

  options.onUnload = function (this: PageInstance) {
    state.lastRoute = routeOf(this);
    return origUnload ? origUnload.call(this) : undefined;
  };

  if (typeof options.onShareAppMessage === "function") {
    const origShare: AnyFn = options.onShareAppMessage;
    options.onShareAppMessage = function (this: PageInstance, res?: Record<string, any>) {
      const result = origShare.call(this, res); // return value must pass through
      const shareProps = buildShareProps(this, result);
      autoEmit("share", { ...shareProps });
      return result;
    };
  }

  options[WRAP_FLAG] = true;
  return options;
}

function emitPageView(page: PageInstance): void {
  const query = ((page as any).__trk_query__ ?? {}) as Record<string, string>;
  // whitelist already applied at onLoad; spread first so reserved fields
  // (route/prev_route) can never be overridden by whitelisted query keys
  const props: PageViewProps = {
    ...query,
    route: routeOf(page),
    prev_route: state.lastRoute,
  };
  autoEmit("page_view", props);
}

function buildShareProps(page: PageInstance, result: Record<string, any> | undefined): ShareProps {
  // target fields come from the whitelisted query of the shared path:
  // id -> target_id, from -> target_type; a share without a path yields nulls.
  const target = parsePathQuery(result && result.path, state.whitelist);
  return {
    page: routeOf(page),
    target_type: target.from ?? null,
    target_id: target.id ?? null,
  };
}

function routeOf(page: PageInstance): string {
  if (page && typeof page.route === "string" && page.route) return page.route;
  try {
    const g = globalThis as Record<string, any>;
    if (typeof g.getCurrentPages === "function") {
      const stack = g.getCurrentPages() as PageInstance[];
      if (stack && stack.length) {
        const top = stack[stack.length - 1];
        if (top && typeof top.route === "string") return top.route;
      }
    }
  } catch {
    /* never break the host */
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Component wrapping: page_view for component-constructed pages       */
/* ------------------------------------------------------------------ */

function wrapComponentOptions(options: Record<string, any>): Record<string, any> {
  if (options[WRAP_FLAG]) return options;
  const lifetimes = (options.pageLifetimes = options.pageLifetimes ?? {});
  const origShow: AnyFn | undefined = lifetimes.show;

  lifetimes.show = function (this: PageInstance) {
    // Only component-constructed PAGES carry `route`; embedded components do
    // not, so they never emit page_view (prevents per-component double reports).
    if (this && typeof this.route === "string" && this.route) {
      emitPageView(this);
    }
    return origShow ? origShow.call(this) : undefined;
  };

  // Component-constructed pages declare lifecycle callbacks in `methods`
  // (older base libraries also allow them at top level) - wrap both shapes:
  // onLoad caches the whitelisted query, onShareAppMessage emits `share`
  // with the original return value passed through untouched.
  const methods = (options.methods = options.methods ?? {});
  const origLoadTop: AnyFn | undefined = options.onLoad;
  if (typeof origLoadTop === "function") {
    options.onLoad = function (this: PageInstance, query?: Record<string, string>) {
      (this as any).__trk_query__ = filterQuery(query, state.whitelist);
      return origLoadTop.call(this, query);
    };
  }
  const origLoadMethods: AnyFn | undefined = methods.onLoad;
  if (typeof origLoadMethods === "function") {
    methods.onLoad = function (this: PageInstance, query?: Record<string, string>) {
      (this as any).__trk_query__ = filterQuery(query, state.whitelist);
      return origLoadMethods.call(this, query);
    };
  }
  const origShareMethods: AnyFn | undefined = methods.onShareAppMessage;
  if (typeof origShareMethods === "function") {
    methods.onShareAppMessage = function (this: PageInstance, res?: Record<string, any>) {
      const result = origShareMethods.call(this, res);
      autoEmit("share", { ...buildShareProps(this, result) });
      return result;
    };
  }
  const origShareTop: AnyFn | undefined = options.onShareAppMessage;
  if (typeof origShareTop === "function") {
    options.onShareAppMessage = function (this: PageInstance, res?: Record<string, any>) {
      const result = origShareTop.call(this, res);
      autoEmit("share", { ...buildShareProps(this, result) });
      return result;
    };
  }

  options[WRAP_FLAG] = true;
  return options;
}
