# Career Quest state

Atlas is a separate release after the hackathon. The submission is preserved at tag `submission-2026-09-23`, SHA `1c397c1f0c10652707e34d9d0f3d4776eda0e97b`. Official origin and history unchanged. Current integration branch: `release/atlas-rebrand`.

Implemented and integrated so far: shared locale negotiation, source catalog RU/KK/EN, local Noto Sans with verified Kazakh glyphs, localized import issue codes and warnings, server/gateway/error languages, structured AI facts and concise live model explanations. Current source snapshot remains 2026-10-01 and 7 source files verify unchanged. Frontend atlas integration is underway.

Verified backend/integration checkpoint: 53 tests, typecheck, build and source manifest pass at `022a1bf`. New-profile real OpenAI: ru 3811ms, kk 2482ms, en 2484ms; all live_ai, four factors, validated alternatives. Small sample, not p95. User timebox from 10:45 UTC: finish implementation/checks within 30–40 minutes; decorative polish is lower priority than working scenarios.

Production remains submission SHA1c397c1 on career.aiviom.ai /34.165.120.4. Rebrand release must not replace it before the agreed post-hackathon release. Shared Caddy and other projects are outside the change scope. Captain submits organizer form; GitHub publication does not submit the form.

See docs/REBRAND.md for design decision, source/font provenance, verification matrix and remaining limitations. Private specification stays ignored locally; no history rewrite.
