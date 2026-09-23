# API smoke from a clean clone

Start the application with `npm start` in one terminal. The API uses the same origin and an HTTP-only demo cookie. This standalone flow uses `curl` and a private temporary cookie jar; remove it when finished. API paths and payloads below match the shipped server. All data is synthetic and scoped to this cookie.

```bash
export CQ_BASE=http://127.0.0.1:3000
export CQ_COOKIE=$(mktemp)
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" "$CQ_BASE/api/session"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" "$CQ_BASE/api/employees/E0082/profile"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" -X POST "$CQ_BASE/api/employees/E0082/recommendations"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" -H 'Content-Type: application/json' -d '{"identity_id":"hr"}' "$CQ_BASE/api/session/switch"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" -H 'Content-Type: application/json' --data-binary @data/demo/import-example.json "$CQ_BASE/api/import/preview"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" -H 'Content-Type: application/json' --data-binary @data/demo/import-example.json "$CQ_BASE/api/import/commit"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" "$CQ_BASE/api/hr/analytics"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" -H 'Content-Type: application/json' -d '{"identity_id":"employee:DEMO_IMPORTED_001"}' "$CQ_BASE/api/session/switch"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" "$CQ_BASE/api/employees/DEMO_IMPORTED_001/profile"
curl -fsS -c "$CQ_COOKIE" -b "$CQ_COOKIE" -X POST "$CQ_BASE/api/employees/DEMO_IMPORTED_001/recommendations"
rm "$CQ_COOKIE"
```

The first demo employee identity maps to `E0082`; the returned `/api/session` identifies the current actor. The recommendation endpoint returns a `mode`; `rules_fallback` is a valid offline run, while `live_ai`/`cached_live_ai` proves real AI. For an end-to-end completion, choose an eligible self-paced activity, such as `EV_015` for `E0082`, and post `{employee_id:"E0082",event_id:"EV_015",evidence:"Completed practical exercise"}` to `/api/completion-requests`. Switch to `advisor`, GET `/api/completion-requests` to find its ID, then POST `{reason:"Evidence reviewed"}` to `/api/completion-requests/:id/accept`. View the profile again to verify the skill credit and XP. Scheduled activities need an actual catalog session in the request, for example `"session":"2026-10-15"` only when that date exists in the selected event’s `upcoming_sessions`, and cannot be accepted before that session date. Every role and side quest control is also available in the UI; server permissions are covered by `npm test`.

For the hosted judge gateway smoke without a local API key, run `npm run smoke:judge` after `career.aiviom.ai` is online. It imports a fresh profile in memory, requests one scoped live recommendation, prints model/mode/latency/IDs without secrets, and exits nonzero unless the mode is live or cached live.
