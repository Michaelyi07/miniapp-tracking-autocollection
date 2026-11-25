# Tracking SDK Auto-Collection: app_launch / page_view / share

TypeScript auto-collection module for the member mini-program tracking SDK: three automatic events with a strict query whitelist (privacy), two integration methods, and an init-level kill switch. The tracking SDK core (TRK-005), buffering/retry (TRK-006) and the event dictionary (TRK-001) are dependencies stubbed via an in-memory sink — integration points listed below. All data fictional; no client name.

## Events

| Event | Trigger | Props |
|---|---|---|
| `app_launch` | `App.onLaunch` (cold start) and `App.onShow` (warm re-entry) | `scene` (from launch/show options; `null` when absent), `cold_start` (boolean: `true` on the launch sequence, `false` on warm re-entry) |
| `page_view` | wrapped `Page.onShow` (and `pageLifetimes.show` of component-constructed pages) | `route`, `prev_route` (route of the previously hidden page; `null` when none), plus whitelisted query params (`id`, `from`) captured at `onLoad` |
| `share` | wrapped `Page.onShareAppMessage` | `page` (current route), `target_type` / `target_id` (parsed from the whitelisted query of the returned share `path`: `from` → `target_type`, `id` → `target_id`; `null` when the handler returns no path) |

Lifecycle semantics per WeChat official docs: cold start fires `onLaunch` then `onShow` (the first `onShow` belongs to the cold-start sequence and emits no second event); hot start fires `onShow` only. `query` reaches a page only through `onLoad(options)` — the wrapper caches it there; `onShow` has no parameters. `prev_route` is cached on `onHide`/`onUnload` and reported by the next visible page (it is not cleared after consumption; re-showing a page without hiding keeps `prev_route` unchanged).
Component-constructed pages (official recommended form for complex pages) are wrapped too: `onLoad` (top level or in `methods`) caches the whitelisted query, `methods.onShareAppMessage` / top-level `onShareAppMessage` emit `share`, and `pageLifetimes.show` emits `page_view`. Embedded components (no `route`) never emit `page_view`, preventing per-component double reports.

## Privacy: query whitelist

Only whitelisted keys (`id`, `from` by default; configurable via `init({ whitelist })`) may enter event props. Everything else — phone numbers, emails, tokens, names — is dropped before the event object is built, and URI decoding is applied to surviving values (malformed encodings kept raw, never thrown). Whitelisted keys with empty values are omitted. The same filter governs `target_type`/`target_id` extracted from share paths. A dedicated privacy test injects phone/email/token/name params and asserts none appear (see `tests/whitelist.test.ts`).

## Integration

### 1. Global auto-injection

```ts
// app.ts - init() MUST run before App()/Page()/Component() are called
import { init } from "./tracking-sdk/src/index";

init({
  autoCollect: true,             // master switch; false disables ALL automatic events
  whitelist: ["id", "from"],     // optional, default shown
  onEvent: (e) => transport.send(e), // optional sink; default keeps events in an in-memory buffer
});
```

`init()` wraps the global `App`/`Page`/`Component` constructors once (`__trk_patched__` marker). Original handlers are preserved and called with the original arguments; `onShareAppMessage` return values pass through untouched. Pages that do not define `onShareAppMessage` are left untouched (the share menu is not injected).

### 2. Per-page wrapper

```ts
import { trackPage } from "./tracking-sdk/src/index";

Page(
  trackPage({
    data: { title: "示例产业沙龙" },
    onLoad(query) { /* ... */ },
    onShareAppMessage() {
      return { title: "示例产业沙龙", path: "/pages/demo/index?id=evt_001&from=share" };
    },
  }),
);
```

### Combining both

Safe: `trackPage` and the global injection share the same wrapping functions, and a `__trk_wrapped__` marker on the options object prevents double wrapping — one `page_view` per `onShow` even when both are applied. Double `trackPage` on the same object is a no-op (same reference returned).

### Kill switch

`init({ autoCollect: false })` skips all patching and gates every automatic emission (injected or `trackPage`). Manual `track("event_name", props)` always works. Note: with `autoCollect: false`, pages wrapped by `trackPage` also stop emitting automatic events — that is the documented behavior of the switch.

## Integration points (stubs)

| Dependency | Ticket | Stub in this package |
|---|---|---|
| Tracking SDK core (transport/batching) | TRK-005 | `init({ onEvent })` callback + default in-memory buffer (`getEmittedEvents()`); replace with the real transport when TRK-005 lands |
| Buffering / retry | TRK-006 | Not implemented here (out of scope) |
| Member mini-program (S3-MINI) | — | Mocked `wx` / `App` / `Page` / `Component` / `getCurrentPages` in `tests/mockedWx.ts`; `sample/` shows real-shaped usage |

## Run and test

```bash
npm install
npm run typecheck   # tsc --noEmit over src/ tests/ sample/
npm test            # jest, 21 tests across 6 suites
npm run build       # typecheck + CI-mode test run
```

Requires Node 18+ (developed on Node 22, TypeScript 5.5, Jest 29). Real run transcripts: `verification_log.md`.

## Files

```
src/index.ts          exports
src/sdk.ts            init / track / trackPage / auto-injection wrappers
src/queryFilter.ts    whitelist filter + share-path query parser
src/types.ts          shared types
src/wx-globals.d.ts   ambient declarations for the mini-program runtime
sample/app.ts         global auto-injection demo (fictional)
sample/pages/demo/index.ts   trackPage demo + manual track (fictional)
tests/                6 suites / 21 tests (mocked wx runtime)
```

## Known boundaries

- `App()` must be called exactly once by the host app and `init()` must precede it (official constraint); init after registration is not supported.
- Frameworks that hide the native constructors (Taro/uni-app) need their plugin mechanism instead of global injection (documented; out of scope here).
- The default sink is an in-memory buffer: events are not sent anywhere until the real transport (TRK-005) is wired through `onEvent`.
