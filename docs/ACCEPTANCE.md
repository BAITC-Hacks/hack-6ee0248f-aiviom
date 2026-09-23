# Acceptance evidence

| Scope | Check | Result |
|---|---|---|
|T01–T03,T05–T09,T12,T14|`npm test`, `npm run verify:source`|PASS: immutable 7-file source manifest, wrappers/counts, import, formulas, dates/caps, EV_036, preview, scoped analytics|
|T10–T11,T13,T17|HTTP integration/adversarial tests|PASS: RBAC, workspace isolation, transactions, double acceptance/redemption, revision workflow, preserved terminal history and imported XP baseline|
|T04,T15–T16|AI provider tests + `scripts/live-smoke.ts`|PASS: valid live recommendations on a new profile; four factor groups, alternative IDs, injection rejection, cache invalidation|
|T18|Local measured cold/cache/new goal + browser|Observed 2.151s/1ms/2.697s; external search4.713s. Small sample, no p95 claim. Mobile390 and desktop checked in built-in Codex Browser|
|T19|Independent clone 0f931db, no .env/key, isolated DB|PASS offline: install/build,36 tests, five roles/import/completion/quest/HR. Documentation mismatches corrected afterward. Hosted live gateway pending final check|
|T20|Source manifest, dependency audit, secret-pattern scan, remote SHA|PASS on intermediate0f931db: zero dependency vulnerabilities and no high-confidence secret matches. Final remote/deploy verification pending|

Final audit additions test approved quest alternatives without gain, preserved declined records and no retroactive reward after historical import. Backend test fixtures use isolated disposable databases and no paid API. Full professional kk/en localization, corporate SSO and configurable HR catalog/reward/advisor administration are not implemented; demo policies are explicit.
