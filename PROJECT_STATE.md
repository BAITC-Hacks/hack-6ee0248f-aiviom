# Career Quest state
2026-09-23, final release preparation (Asia/Almaty). Official private origin/main; initial teammate history preserved.

Implemented: immutable archive import, common skill/eligibility/roadmap formulas, five server-scoped demo roles, live AI with validated factors/alternatives, pure preview, transactional completion/quest/XP/rewards, HR analytics/import, external sourced proposals. Original source counts: 200 employees /40 events /60 skills /32 role profiles /2743 history rows.

Verified: independent clean clone at c2c84d7 installed/built, 39 tests passed, five role APIs, new import, completion, full quest, workspace isolation and restart persistence. Final audit fixed preservation of declined history, import lifetime XP baseline, scheduled completion date, per-workspace gateway cookies, total gateway deadline and reservation only on real provider request. Regression checks added. UI verified in Codex browser including mobile390, import without history and refreshed HR totals.

Live AI: new-profile cold2.151s, changed-goal2.697s, cached1ms; external sourced search4.713s. These are small local samples, not a p95 guarantee. Hosted clean access PASS: no .env/key, new-profile live_ai6244ms (1753 input/319 output tokens). HTTPS health and browser UI PASS.

Release target: career.aiviom.ai /34.165.120.4, isolated career-quest Compose on127.0.0.1:3500. DNS resolves correctly. One shared Caddy restart authorized after validation. Final application is deployed; documentation-only publication follows.

Captain submits organizer form. GitHub push alone is not form submission. Private specification removed from tracked main at owner's request; local copy retained, history not rewritten.
