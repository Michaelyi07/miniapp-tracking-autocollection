import { createEnv, makePage, eventsOf } from "./mockedWx";
import { init, trackPage, __resetForTests } from "../src/index";

beforeEach(() => {
  __resetForTests();
  delete (globalThis as any).App;
  delete (globalThis as any).Page;
  delete (globalThis as any).Component;
});

describe("AC4 - two integration methods without double emission", () => {
  test("trackPage(options) emits page_view per integration", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true }); // per-page integration (same auto pipeline, wrap marker prevents double)
    const options = trackPage({
      data: {},
      onLoad() {},
      onShow() {},
      onShareAppMessage() {
        return { title: "t", path: "/pages/demo/index?id=d_01&from=share" };
      },
    });
    const page = makePage(env, "pages/demo/index", options);
    page.onLoad({ id: "d_01", from: "share" });
    page.onShow();
    const events = eventsOf(env, "page_view");
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({
      route: "pages/demo/index",
      prev_route: null,
      id: "d_01",
      from: "share",
    });
    page.onShareAppMessage({ from: "button" });
    expect(eventsOf(env, "share")).toHaveLength(1);
  });

  test("global injection + trackPage on the same page: no double page_view (per-page guard)", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true }); // globals patched now
    const wrapped = trackPage({
      onLoad() {},
      onShow() {},
    }); // already marked by the patched global Page? trackPage runs before Page() call
    const page = makePage(env, "pages/demo/index", wrapped);
    page.onLoad({ id: "d_02" });
    page.onShow();
    page.onHide(); // route cached as prev_route candidate (official lifecycle semantics)
    page.onShow();
    const events = eventsOf(env, "page_view");
    expect(events).toHaveLength(2); // one per onShow, not two per onShow
    expect(events[0].props.id).toBe("d_02");
    expect(events[1].props.prev_route).toBe("pages/demo/index");
  });

  test("double trackPage on the same options object is a no-op", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const options = { onLoad() {}, onShow() {} };
    const once = trackPage(options);
    const twice = trackPage(once);
    expect(twice).toBe(once);
    const page = makePage(env, "pages/demo/index", twice);
    page.onLoad({});
    page.onShow();
    expect(eventsOf(env, "page_view")).toHaveLength(1);
  });
});
