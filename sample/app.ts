/**
 * Sample: global auto-injection integration (app.ts).
 * init() must run before App()/Page()/Component() are called.
 */
import { init } from "../src/index";

init({
  autoCollect: true, // master switch for automatic events
  whitelist: ["id", "from"], // default; explicit here for demonstration
});

App({
  onLaunch() {
    // business boot; app_launch was emitted automatically with scene + cold_start
  },
});
