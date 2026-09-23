# Independent HTTP audit

Audit base: `ff4925397c03fa511dbcfe47de9d006a42f07619` on `test/independent-audit`. Tests use an isolated temporary SQLite database, a random local HTTP port, `AI_MODE=offline`, `JUDGE_GATEWAY_URL=off`, and no API key. They call the public HTTP routes without a browser. Run with `npx tsx --test tests/audit.integration.test.ts`; no production or demo database is touched.

Initial run on this base: **13 cases, 7 pass, 6 fail**; `npm run typecheck` passes. The failing cases are intended regression checks for defects reported to the coordinator, who owns server changes:

| Check | Observed on base | Required behavior |
|---|---|---|
| Malformed JSON | `POST /api/plan` with `{` returns 500 `INTERNAL` | 400 JSON error envelope |
| Unknown API route | `/api/no-such-endpoint` returns HTML 404 | JSON 404 error envelope |
| Import ID safety | `__proto__` accepted by preview | Reject reserved and oversized IDs before touching state |
| Assignment date | `2026-12-32` accepted and written | Reject impossible calendar date |
| Proposal revision | No author resubmit route after `needs_revision` | Author can edit/resubmit for advisor review |
| Evidence revision | Advisor cannot revise submitted evidence | Return to author without granting credit; accept only after revised evidence |

Passing cases verify atomic rejection of a mixed valid/invalid import, workspace isolation, advisor self-approval denial, mandatory assignment permissions and duplicate pending block, scheduled completion after its session with exact completion date, no XP from goal changes, a single debit under concurrent redemption, idempotency key scope, and duplicate evidence rejection.

The test suite asserts response status and stored effects; the invalid due-date test chooses an event with no pending assignment, so it cannot pass merely because the server rejects a duplicate. New workspace cookies are used for each case. The suite does not claim UI, external AI, deployment, or clean-clone acceptance.
