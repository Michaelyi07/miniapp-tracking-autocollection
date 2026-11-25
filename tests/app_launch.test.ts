import { createEnv, eventsOf } from "./mockedWx";
import { init, __resetForTests } from "../src/index";

beforeEach(() => {
  __resetForTests();
  delete (globalThis as any).App;
  delete (globalThis as any).Page;
  delete (globalThis as any).Component;
});

describe("AC1 - app_launch on App.onLaunch (scene + cold start)", () => {
  test("cold start: onLaunch emits app_launch with scene and cold_start=true", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    env.appLaunch({ scene: 1047 });
    const events = eventsOf(env, "app_launch");
    expect(events).toHaveLength(1);
    expect(events[0].props).toEqual({ scene: 1047, cold_start: true });
  });

  test("warm re-entry: a later onShow emits app_launch with cold_start=false", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    env.appLaunch({ scene: 1001 });
    env.appShow({ scene: 1001 }); // cold-start sequence: first show emits nothing
    expect(eventsOf(env, "app_launch")).toHaveLength(1);
    env.appShow({ scene: 1089 }); // warm re-entry
    const events = eventsOf(env, "app_launch");
    expect(events).toHaveLength(2);
    expect(events[1].props).toEqual({ scene: 1089, cold_start: false });
  });

  test("missing scene defaults to null, never a personal field", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    env.appLaunch({});
    const events = eventsOf(env, "app_launch");
    expect(events[0].props).toEqual({ scene: null, cold_start: true });
  });

  test("original onLaunch/onShow handlers are preserved and called", () => {
    const env = createEnv();
    env.initSDK({ autoCollect: true });
    const launched: string[] = [];
    const shown: string[] = [];
    env.registerPage({}); // warm-up for TS
    (globalThis as any).App({
      onLaunch() {
        launched.push("orig-launch");
      },
      onShow() {
        shown.push("orig-show");
      },
    });
    env.appLaunch({ scene: 1001 });
    env.appShow({ scene: 1001 });
    expect(launched).toEqual(["orig-launch"]);
    expect(shown).toEqual(["orig-show"]);
  });
});
