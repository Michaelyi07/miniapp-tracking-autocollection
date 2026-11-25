import { createEnv, makePage, makeComponentPage, eventsOf } from "./mockedWx";
import { init, __resetForTests } from "../src/index";

beforeEach(() => {
  __resetForTests();
  delete (globalThis as any).App;
  delete (globalThis as any).Page;
  delete (globalThis as any).Component;
});

describe("AC2 - page_view wraps Page.onShow (route / prev_route / whitelisted query)", () => {
  test("page_view emits on every onShow with route and whitelisted query", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const page = makePage(env, "pages/detail/index", {
      onLoad() {},
      onShow() {},
    });
    page.onLoad({ id: "evt_001", from: "share", other: "dropped" });
    page.onShow();
    const events = eventsOf(env, "page_view");
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({
      route: "pages/detail/index",
      prev_route: null,
      id: "evt_001",
      from: "share",
    });
    // second onShow (re-visibility) emits again; prev_route updates on hide
    // (official lifecycle semantics: onHide caches the route candidate)
    page.onShow();
    const again = eventsOf(env, "page_view");
    expect(again).toHaveLength(2);
    expect(again[1].props.prev_route).toBeNull();
  });

  test("prev_route comes from the hidden page (onHide caches route)", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const first = makePage(env, "pages/index/index", { onShow() {}, onHide() {} });
    first.onShow();
    first.onHide(); // leaves -> caches its route
    const second = makePage(env, "pages/list/index", { onLoad() {}, onShow() {} });
    second.onLoad({ id: "l_01" });
    second.onShow();
    const events = eventsOf(env, "page_view");
    expect(events[events.length - 1].props).toEqual({
      route: "pages/list/index",
      prev_route: "pages/index/index",
      id: "l_01",
    });
  });

  test("Component-constructed pages emit page_view via pageLifetimes.show (query cached by the wrapped onLoad)", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const instance = makeComponentPage(env, "pages/comp-page/index", {
      pageLifetimes: {
        show() {},
      },
      onLoad(query: Record<string, string>) {
        // business code only; the SDK wrapper caches the filtered query
      },
    });
    instance.onLoad({ id: "c_01", phone: "13800000000" });
    instance.show();
    const events = eventsOf(env, "page_view");
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({
      route: "pages/comp-page/index",
      prev_route: null,
      id: "c_01",
    });
    expect(JSON.stringify(events[0].props)).not.toContain("13800000000");
  });

  test("embedded components (no route) never emit page_view", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const embedded = {
      pageLifetimes: {
        show() {},
      },
    };
    const registered = (globalThis as any).Component(embedded);
    const instance: any = {};
    instance.show = registered.pageLifetimes.show.bind(instance);
    instance.show();
    expect(eventsOf(env, "page_view")).toHaveLength(0);
  });
});
