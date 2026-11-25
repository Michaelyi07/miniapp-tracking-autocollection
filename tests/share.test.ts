import { createEnv, makePage, eventsOf } from "./mockedWx";
import { init, __resetForTests } from "../src/index";

beforeEach(() => {
  __resetForTests();
  delete (globalThis as any).App;
  delete (globalThis as any).Page;
  delete (globalThis as any).Component;
});

describe("AC3 - share wraps onShareAppMessage (page / target_type / target_id)", () => {
  test("share emits page route and target fields parsed from the shared path", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const page = makePage(env, "pages/detail/index", {
      onLoad() {},
      onShow() {},
      onShareAppMessage() {
        return { title: "示例产业沙龙", path: "/pages/detail/index?id=evt_042&from=card" };
      },
    });
    page.onLoad({});
    page.onShow();
    const result = page.onShareAppMessage({ from: "button" });
    expect(result).toEqual({ title: "示例产业沙龙", path: "/pages/detail/index?id=evt_042&from=card" });
    const events = eventsOf(env, "share");
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({
      page: "pages/detail/index",
      target_type: "card",
      target_id: "evt_042",
    });
  });

  test("share without a path emits null target fields, no exception; return value passes through", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const page = makePage(env, "pages/index/index", {
      onShow() {},
      onShareAppMessage() {
        return { title: "示例空间" }; // no path
      },
    });
    page.onShow();
    const result = page.onShareAppMessage({ from: "menu" });
    expect(result).toEqual({ title: "示例空间" });
    const events = eventsOf(env, "share");
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({
      page: "pages/index/index",
      target_type: null,
      target_id: null,
    });
  });

  test("target query values are URI-decoded and non-whitelisted keys dropped", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const page = makePage(env, "pages/detail/index", {
      onShow() {},
      onShareAppMessage() {
        return { title: "t", path: "/pages/detail/index?id=evt%2F007&from=poster&phone=13800000000" };
      },
    });
    page.onShow();
    page.onShareAppMessage({ from: "button" });
    const events = eventsOf(env, "share");
    expect(events[0].props).toEqual({
      page: "pages/detail/index",
      target_type: "poster",
      target_id: "evt/007",
    });
    expect(JSON.stringify(events[0].props)).not.toContain("13800000000");
    expect(JSON.stringify(events[0].props)).not.toContain("phone");
  });

  test("pages without onShareAppMessage are untouched (no handler injected)", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const page = makePage(env, "pages/plain/index", { onShow() {} });
    expect(page.onShareAppMessage).toBeUndefined();
    expect(eventsOf(env, "share")).toHaveLength(0);
  });
});
