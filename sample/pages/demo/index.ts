/**
 * Sample page: per-page integration via trackPage(options).
 * Demonstrated together with global injection in sample/app.ts - the wrap
 * marker guarantees the page_view is emitted once per onShow, not twice.
 *
 * All data fictional; no client name.
 */
import { trackPage, track } from "../../../src/index";

Page(
  trackPage({
    data: {
      title: "示例产业沙龙",
      eventId: "evt_001",
    },

    onLoad(query: Record<string, string>) {
      // query = { id: "evt_001", from: "share" } for a shared entry;
      // non-whitelisted params never enter tracking props.
      console.log("demo page query:", query);
    },

    onShow() {
      // page_view emitted automatically (route / prev_route / id / from)
    },

    onShareAppMessage() {
      // share event emitted automatically with page/target_type/target_id
      // (target fields parsed from the whitelisted query of this path)
      return {
        title: "示例产业沙龙",
        path: "/pages/demo/index?id=evt_001&from=share",
        // imageUrl: "/assets/share-cover.png",
      };
    },

    // manual tracking is always available, unaffected by autoCollect
    onTapSignup() {
      track("demo_manual_event", { id: "evt_001", action: "signup_click" });
    },
  }),
);
