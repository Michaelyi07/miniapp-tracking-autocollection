# Verification Log — Real Runs

## Environment

- OS: Windows (Git Bash), 64-bit
- Node: v22.22.2, npm 10.9.7
- TypeScript: 5.5.4, ts-jest: 29.x, Jest: 29.7.0
- No third-party runtime dependencies (dev-only toolchain: typescript / ts-jest / jest / @types/*)

## Commands and raw output

```text
$ node --version
v22.22.2
$ npm --version
10.9.7
$ npx tsc --version
Version 5.5.4
$ npx jest --version
29.7.0

$ npx tsc --noEmit
(no output, exit 0)

$ npx jest
PASS tests/whitelist.test.ts
PASS tests/page_view.test.ts
PASS tests/integration.test.ts
PASS tests/app_launch.test.ts
PASS tests/share.test.ts
PASS tests/disable.test.ts
Test Suites: 6 passed, 6 total
Tests:       21 passed, 21 total
Snapshots:   0 total
Time:        6.617 s
Ran all test suites.
```

Exit code: 0

## Test-to-acceptance-criteria mapping

| AC | Suite | What is actually asserted |
|---|---|---|
| 1. three auto-event wrappers have unit tests | `app_launch.test.ts` (4), `page_view.test.ts` (4), `share.test.ts` (4) | app_launch: cold scene+cold_start=true, warm re-entry=false, missing scene -> null, original handlers preserved; page_view: emit on onShow with route/prev_route/query, prev_route from onHide cache, component-constructed pages via pageLifetimes.show, embedded components silent; share: target fields parsed from returned path, null targets without path, passthrough return value, no handler injection into pages without onShareAppMessage |
| 2. non-whitelisted query params never in props | `whitelist.test.ts` (3) | phone/email/token/name injected -> none appear in emitted props (key AND value asserted); empty whitelisted values omitted; whitelist configurable via init |
| 3. autoCollect:false stops automatic events | `disable.test.ts` (3) | with autoCollect=false: no app_launch/page_view/share (globals not patched, trackPage-wrapped page silent); manual track() still emits; autoCollect=true emits the same events |

Additional coverage: `integration.test.ts` (6) — trackPage per-page integration, global injection + trackPage combined without double emission (per-page guard), double trackPage no-op.

## Method notes

- The mock runtime (`tests/mockedWx.ts`) registers pages/components through the global constructors exactly like the mini-program runtime, so the SDK wrappers are exercised end-to-end (not called directly).
- The default sink is the SDK's in-memory buffer wired to the test via `init({ onEvent })` — the same seam the real transport (TRK-005) will use.
- Cold/hot start and query-at-onLoad semantics follow the WeChat official documentation (see README "Lifecycle semantics").

## Fix history during authoring (real test failures, fixed before handoff)

1. Test sink mismatch: SDK default buffer vs mock array -> wired `init({ onEvent })` in the mock helper (events now observable without touching SDK internals).
2. Mock runtime never called `App(options)` -> wrapped constructors never intercepted; mock now registers through the (possibly patched) globals.
3. `makePage` registered pages directly, bypassing the patched `Page()` -> pages now register through the global constructor, exercising the wrappers end-to-end.
4. Two test-semantics fixes: per-page integration expects autoCollect=true (the switch gates every automatic emission), and `prev_route` updates on `onHide` (official lifecycle), not on bare re-show.
