# Acceptance evidence

## Atlas release checks, 2026-09-23

- Preserved submission: `submission-2026-09-23` / `1c397c1f0c10652707e34d9d0f3d4776eda0e97b`. Atlas work is isolated on `release/atlas-rebrand`.
- Integrated checks: 57 tests, TypeScript check, production build and immutable 7-file manifest pass. Coverage includes RU/KK/EN key/parameter parity, calendar-date stability, catalog translations, localized API envelopes and cache separation.
- Independent clean clone at `82870a1`: install, 54 then-existing tests, build/source and isolated offline API scenarios for all five roles passed. New arbitrary-ID import, advisor acceptance, skill/XP changes and restart persistence passed without a local key or `.env`. Later locale smoke at `83a506e` used only the locally hosted candidate gateway: RU 3575ms, KK 3354ms, EN 2835ms, all live AI. This is not a production deployment claim.
- Final clean-clone application check at `6293c601fa73d20bcd663d8b02ba8bff6b56381c`: 57/57 tests, typecheck, build and source verification passed. This includes the final tablet and dropdown corrections.
- Final prompt v2.2 real new-profile OpenAI check at `d10904e`: RU 2637ms, KK 2645ms, EN 2743ms, all `live_ai`, four verified factors and real alternatives. These are single-call measurements, not p95.
- Built-in Codex Browser: 57 role/language/page combinations at desktop 1440 and 57 at mobile 390. All accessible screens loaded without application alerts. Found mobile overflow was fixed; independent confirmation checked path and HR at 320/360/390/768/1024/1440 without page overflow.
- Browser actions: recommendation fallback honestly labeled, preview, plan addition, advisor acceptance of synthetic evidence, updated skill/balance, invalid import, replacement invalidating old preview, valid import application. Escape closed More and restored trigger focus.
- Independent design review requested a final fix batch for tablet project detail, control border contrast, mobile text size and stale brand documentation. The owner additionally requested a styled opening language list. Final confirmation: PASS. Tablet detail spans 720px; 320px role popup stays inside the dialog, scrolls internally and selects the last option with End/Enter. No console warnings/errors.
- Styled selector checks: Home/Enter/Escape, search with Arrow/Enter, Tab/Shift+Tab exit and 320px popup bounds passed. Reduced-motion emulation suppressed transitions and was reset.
- Boundaries: actual 200% browser zoom was not verified; no physical phone/Safari, screen-reader or native Kazakh reviewer certification. Three-language production gateway and post-deploy HTTPS checks await the separate post-hackathon rollout.

## Historical submission checks


| Scope | Check | Result |
|---|---|---|
|T01–T03,T05–T09,T12,T14|`npm test`, `npm run verify:source`|PASS: immutable 7-file source manifest, wrappers/counts, import, formulas, dates/caps, EV_036, preview, scoped analytics|
|T10–T11,T13,T17|HTTP integration/adversarial tests|PASS: RBAC, workspace isolation, transactions, double acceptance/redemption, revision workflow, preserved terminal history and imported XP baseline|
|T04,T15–T16|AI provider tests + `scripts/live-smoke.ts`|PASS: valid live recommendations on a new profile; four factor groups, alternative IDs, injection rejection, cache invalidation|
|T18|Local measured cold/cache/new goal + browser|Observed 2.151s/1ms/2.697s; external search4.713s. Small sample, no p95 claim. Mobile390 and desktop checked in built-in Codex Browser|
|T19|Independent clone c2c84d7, no .env/key, isolated DB|PASS offline: install/build,39 tests, restart persistence, five roles/import/completion/quest/HR. Corrected API walkthrough passed; restart retained skills/XP/import/session. PASS hosted live gateway: clean env/no key, new profile, live_ai6244ms,1753 input/319 output tokens|
|T20|Source manifest, dependency audit, secret-pattern scan, remote SHA|PASS on c2c84d7: zero dependency vulnerabilities and no high-confidence secret matches. HTTPS health and hosted UI PASS; final documentation-only SHA checked at publication|

Final audit additions test approved quest alternatives without gain, preserved declined records and no retroactive reward after historical import. Backend test fixtures use isolated disposable databases and no paid API. For this historical submission, full kk/en localization was not implemented. Atlas adds RU/KK/EN; corporate SSO and configurable HR catalog/reward/advisor administration remain outside this release. Demo policies are explicit.
