/**
 * Shared mock mini-program runtime for unit tests.
 * Captures registered App/Page/Component options and simulates the page stack.
 */
export interface MockEnv {
  emitted: Array<{ event: string; props: Record<string, unknown> }>;
  /** call SDK init() wired to this env's sink (emitted[]) */
  initSDK: (config?: Record<string, any>) => void;
  registered: {
    app?: Record<string, any>;
    pages: Record<string, any>[];
    components: Record<string, any>[];
  };
  /** run the App.onLaunch handler (after SDK wrapping) */
  appLaunch: (options?: Record<string, any>) => void;
  /** run the App.onShow handler */
  appShow: (options?: Record<string, any>) => void;
  /** register a page through the (possibly patched) global Page() */
  registerPage: (options: Record<string, any>) => Record<string, any>;
  /** register a component through the (possibly patched) global Component() */
  registerComponent: (options: Record<string, any>) => Record<string, any>;
  /** push a page instance onto the simulated stack */
  pushStack: (page: Record<string, any>) => void;
  popStack: () => Record<string, any> | undefined;
  stackSize: () => number;
}

export function createEnv(): MockEnv {
  const emitted: MockEnv["emitted"] = [];
  const registered: MockEnv["registered"] = { pages: [], components: [] };
  const stack: Record<string, any>[] = [];

  const g = globalThis as Record<string, any>;
  g.wx = {
    getLaunchOptionsSync: () => ({ scene: 1001, path: "pages/index/index", query: {} }),
    getEnterOptionsSync: () => ({ scene: 1001, path: "pages/index/index", query: {} }),
  };
  g.getCurrentPages = () => stack;
  g.App = (options: Record<string, any>) => {
    registered.app = options;
    return options;
  };
  g.Page = (options: Record<string, any>) => {
    registered.pages.push(options);
    return options;
  };
  g.Component = (options: Record<string, any>) => {
    registered.components.push(options);
    return options;
  };

  return {
    emitted,
    initSDK(config: Record<string, any> = {}) {
      // lazy import keeps this helper usable before module side effects
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sdk = require("../src/index") as typeof import("../src/index");
      sdk.init({ ...config, onEvent: (e: { event: string; props: Record<string, unknown> }) => emitted.push(e) });
    },
    registered,
    appLaunch(options) {
      // register a default app through the (possibly patched) global if the
      // test did not register one itself - mirrors app.js calling App(...)
      if (!registered.app) {
        (globalThis as any).App({ onLaunch() {}, onShow() {} });
      }
      registered.app && registered.app.onLaunch && registered.app.onLaunch(options ?? { scene: 1001 });
    },
    appShow(options) {
      if (!registered.app) {
        (globalThis as any).App({ onLaunch() {}, onShow() {} });
      }
      registered.app && registered.app.onShow && registered.app.onShow(options ?? { scene: 1001 });
    },
    registerPage(options) {
      registered.pages.push(options);
      return options;
    },
    registerComponent(options) {
      registered.components.push(options);
      return options;
    },
    pushStack(page) {
      stack.push(page);
    },
    popStack() {
      return stack.pop();
    },
    stackSize: () => stack.length,
  };
}

/** Build a fake page instance with lifecycle methods bound. */
export function makePage(env: MockEnv, route: string, options: Record<string, any> = {}): Record<string, any> {
  // register through the (possibly patched) global Page() like the runtime does
  const opts = (globalThis as any).Page(options);
  const instance: Record<string, any> = { route };
  // copy wrapped handlers onto the instance like the mini-program runtime does
  for (const key of ["onLoad", "onShow", "onHide", "onUnload", "onShareAppMessage"]) {
    if (typeof opts[key] === "function") instance[key] = opts[key].bind(instance);
  }
  return instance;
}

/** Component-constructed page instance (carries route). */
export function makeComponentPage(env: MockEnv, route: string, options: Record<string, any>): Record<string, any> {
  const opts = (globalThis as any).Component(options);
  const instance: Record<string, any> = { route };
  if (opts.pageLifetimes && typeof opts.pageLifetimes.show === "function") {
    instance.show = opts.pageLifetimes.show.bind(instance);
  }
  if (opts.methods) {
    for (const [k, fn] of Object.entries(opts.methods)) {
      if (typeof fn === "function") instance[k] = (fn as any).bind(instance);
    }
  }
  return instance;
}

/** Embedded regular component instance (no route). */
export function makeEmbeddedComponent(env: MockEnv, options: Record<string, any>): Record<string, any> {
  const opts = (globalThis as any).Component(options);
  const instance: Record<string, any> = {};
  if (opts.pageLifetimes && typeof opts.pageLifetimes.show === "function") {
    instance.show = opts.pageLifetimes.show.bind(instance);
  }
  return instance;
}

export function eventsOf(env: MockEnv, type: string) {
  return env.emitted.filter((e) => e.event === type);
}
