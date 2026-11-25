import { createEnv, makePage, eventsOf } from "./mockedWx";
import { init, track, __resetForTests } from "../src/index";

beforeEach(() => {
  __resetForTests();
  delete (globalThis as any).App;
  delete (globalThis as any).Page;
  delete (globalThis as any).Component;
});

describe("AC5 - init({autoCollect:false}) suppresses automatic events; manual track() works", () => {
  test("no app_launch / page_view / share when autoCollect=false", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: false });
    // globals are NOT patched: App/Page/Component stay the raw mock captures
    expect((globalThis as any).App.__trk_patched__).toBeUndefined();
    expect((globalThis as any).Page.__trk_patched__).toBeUndefined();
    env.appLaunch({ scene: 1001 });
    const page = makePage(env, "pages/index/index", {
      onLoad() {},
      onShow() {},
      onShareAppMessage() {
        return { title: "t", path: "/pages/index/index?id=x1" };
      },
    });
    page.onLoad({ id: "x1" });
    page.onShow();
    page.onShareAppMessage({ from: "menu" });
    expect(eventsOf(env, "app_launch")).toHaveLength(0);
    expect(eventsOf(env, "page_view")).toHaveLength(0);
    expect(eventsOf(env, "share")).toHaveLength(0);
    expect(env.emitted).toHaveLength(0);
  });

  test("manual track() still works when autoCollect=false", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: false });
    track("manual_event", { id: "m_01" });
    expect(env.emitted).toHaveLength(1);
    expect(env.emitted[0]).toMatchObject({ event: "manual_event", props: { id: "m_01" } });
  });

  test("autoCollect=true emits the same events that are suppressed when false", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    env.appLaunch({ scene: 1001 });
    const page = makePage(env, "pages/index/index", { onLoad() {}, onShow() {} });
    page.onLoad({ id: "x1" });
    page.onShow();
    expect(eventsOf(env, "app_launch")).toHaveLength(1);
    expect(eventsOf(env, "page_view")).toHaveLength(1);
  });
});
