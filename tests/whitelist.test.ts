import { createEnv, makePage, eventsOf } from "./mockedWx";
import { init, __resetForTests } from "../src/index";

beforeEach(() => {
  __resetForTests();
  delete (globalThis as any).App;
  delete (globalThis as any).Page;
  delete (globalThis as any).Component;
});

describe("AC6 / privacy - non-whitelisted query params never reach emitted props", () => {
  test("phone/email/token params are dropped; only id/from survive", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const page = makePage(env, "pages/detail/index", {
      onLoad() {},
      onShow() {},
    });
    page.onLoad({
      id: "evt_001",
      from: "share",
      phone: "13800000000",
      email: "user@example.com",
      token: "secret-token-value",
      name: "张三",
    });
    page.onShareAppMessage = undefined; // keep the share path out of this test
    page.onShow();
    const events = eventsOf(env, "page_view");
    expect(events[0].props).toEqual({
      route: "pages/detail/index",
      prev_route: null,
      id: "evt_001",
      from: "share",
    });
    const serialized = JSON.stringify(events[0].props);
    for (const banned of ["13800000000", "user@example.com", "secret-token-value", "张三", "phone", "email", "token", "name"]) {
      expect(serialized).not.toContain(banned);
    }
  });

  test("empty whitelisted values are omitted (?id=&from=)", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const page = makePage(env, "pages/detail/index", { onLoad() {}, onShow() {} });
    page.onLoad({ id: "", from: "" });
    page.onShow();
    const props = eventsOf(env, "page_view")[0].props;
    expect(Object.keys(props)).toEqual(["route", "prev_route"]);
  });

  test("whitelist can be widened via init() config", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true, whitelist: ["id", "from", "utm_source"] });
    const page = makePage(env, "pages/detail/index", { onLoad() {}, onShow() {} });
    page.onLoad({ id: "x1", utm_source: "poster", phone: "13800000000" });
    page.onShow();
    expect(eventsOf(env, "page_view")[0].props).toEqual({
      route: "pages/detail/index",
      prev_route: null,
      id: "x1",
      utm_source: "poster",
    });
  });
});
