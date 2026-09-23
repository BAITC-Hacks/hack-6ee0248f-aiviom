# Career Quest · AIVIOM — Technical Documentation

This document describes the application **as implemented in the repository**. It is intended for technical reviewers who need to understand, run, inspect, and verify the system without relying on a presentation.

Public demo: **https://career.aiviom.ai**

## 1. System purpose

Career Quest is a career-development navigation platform built around a structured employee/skills/activity dataset. It calculates current skill state and target gaps, identifies eligible learning/development actions, constructs roadmaps, adds an explainable AI recommendation layer, and protects state-changing outcomes with server-side workflows and role checks.

The system does not equate an AI recommendation with a verified outcome. Preview, planning, proposal approval, evidence submission, and accepted completion are separate states.

## 2. Runtime topology

The application runs as one Node.js process in normal local or container deployment.

```text
React browser client
      │
      ▼
Express HTTP server
      │
      ├─ static Vite build
      ├─ REST-style JSON API
      ├─ demo session/workspace management
      ├─ RBAC and scope checks
      ├─ domain engine
      ├─ workflow engine
      ├─ import validation
      ├─ recommendation orchestration
      └─ SQLite persistence
             │
             └─ .runtime/career-quest.sqlite
```

The frontend and backend are in the same repository and are built from the same TypeScript codebase.

## 3. Repository structure

```text
.
├── src/
│   ├── ai/
│   │   ├── index.ts              # recommendation orchestration/validation/cache/fallback
│   │   └── external.ts           # external opportunity search adapter
│   ├── client/
│   │   ├── main.tsx
│   │   ├── api.ts
│   │   ├── i18n.tsx
│   │   └── screens/              # employee, catalog, quests, analytics, people, audit, rewards
│   ├── domain/
│   │   ├── calculation.ts        # eligibility and skill-state rules
│   │   ├── analytics.ts
│   │   ├── roadmap.ts
│   │   ├── import.ts
│   │   └── source.ts
│   ├── server/
│   │   ├── index.ts              # startup/static hosting
│   │   ├── app.ts                # API routing and HTTP controls
│   │   ├── access.ts             # role/scope authorization helpers
│   │   ├── store.ts              # SQLite persistence, seed, sessions, audit/ledger helpers
│   │   ├── workflows.ts          # completion and side-quest workflow transitions
│   │   ├── gateway.ts            # restricted judge AI gateway client
│   │   └── ai-budget.ts          # AI reservation/settlement ledger
│   └── shared/                    # types and localization contracts
├── data/
│   ├── source/                    # supplied case dataset
│   └── demo/                      # deterministic reviewer/import fixture
├── tests/                         # domain/server/integration/AI/i18n tests
├── scripts/                       # source verification and smoke scripts
├── Dockerfile
├── compose.yml
├── .env.example
├── package.json
└── package-lock.json
```

## 4. Server lifecycle

`src/server/index.ts` loads environment variables, configures the Express application, serves the built Vite frontend when `dist/` exists, installs the API error handler, and starts the HTTP server.

The health endpoint is independent of demo workspace creation:

```http
GET /health
```

It returns `ok`, the service name, and `RELEASE_SHA` or `development`.

## 5. Demo workspace/session model

All `/api/*` calls pass through demo-session middleware in `src/server/app.ts`.

If the browser does not yet have a valid session, the server creates:

- a new isolated workspace;
- a demo identity inside that workspace;
- an HTTP-only `cq_session` cookie.

The cookie uses `SameSite=Lax`; `secure` follows the request security context. New-session creation is rate-limited per source IP.

The demo identity can be switched through:

```http
POST /api/session/switch
```

This is a judging/demo mechanism, not production SSO.

Each state-changing request is executed against the session's workspace. Integration tests include workspace isolation checks.

## 6. Authorization model

Authorization helpers are implemented in `src/server/access.ts` and used by API/workflow code rather than trusting `role` from request bodies.

Relevant concepts:

- **role** — verifies a permitted demo role.
- **own** — verifies employee self-scope.
- **scope** — verifies that the current identity may access the requested employee.
- **reviewer** — verifies review authority for completion/quest decisions.
- **canRead** — filters collection responses to permitted employees.

This model is exercised by server/integration tests for cross-workspace access, self-approval and role restrictions.

## 7. Data model and source data

The canonical source files are under `data/source/`:

- `employees.json`
- `events.json`
- `skills.json`
- `activity_history.csv`
- role/grade profiles loaded by the source layer

The runtime state extends this source dataset with demo/application entities such as:

- plans;
- side quests;
- completion requests;
- help requests;
- credits;
- reward ledger;
- audit events;
- advisor assignments;
- demo workspace date/version data.

Source data is not edited in-place by normal runtime actions.

## 8. Persistence

Persistence uses `better-sqlite3`.

Default path:

```text
.runtime/career-quest.sqlite
```

Docker path:

```text
/app/.runtime/career-quest.sqlite
```

`compose.yml` attaches `/app/.runtime` to a named Docker volume, so `docker compose down` preserves state. `docker compose down -v` deletes the named volume and must therefore be treated as a destructive reset.

The application stores serialized workspace state plus server-side session/guard/AI-budget support records in SQLite.

## 9. Domain engine

`src/domain/` is responsible for deterministic business logic. It is deliberately separated from the AI layer.

Main responsibilities include:

### 9.1 Effective skill state

Skill values are reconstructed from the baseline/source state plus eligible verified credits/completions. Gain caps are enforced so a gain cannot exceed its configured maximum level.

### 9.2 Target and gaps

A goal contains:

- `target_role`
- `target_grade` (`Junior`, `Middle`, `Senior`, `Lead`)

The server validates the target against the role-profile catalog. Gaps are computed relative to required target skills.

### 9.3 Eligibility

Candidate activities are constrained by hard rules such as:

- audience/role/grade applicability;
- prerequisites;
- previous completions;
- scheduled-session availability;
- mandatory-assignment semantics.

The AI layer receives candidates after this domain filtering; it is not permitted to invent new catalog IDs.

### 9.4 Preview

`POST /api/employees/:id/preview` simulates the impact of one event using the domain engine. It does not write to persistent state.

### 9.5 Roadmap

`GET /api/employees/:id/roadmap` builds a feasible sequence based on current gaps, prerequisites, candidate activities, side-quest alternatives, and weekly budget.

### 9.6 Analytics

`GET /api/hr/analytics` builds aggregate metrics on the employee set visible to the current role/scope.

## 10. Recommendation subsystem

Recommendation code is primarily in `src/ai/index.ts`.

### 10.1 Principle

The model is used to **choose/explain among server-computed candidates**, not to determine authoritative eligibility or grant credits.

### 10.2 Inputs

The server constructs a fact bundle from the current profile, goal, gaps, history and candidate catalog items.

### 10.3 Output validation

AI output is validated before it is returned. The implementation checks, among other things:

- returned event IDs belong to permitted candidates;
- alternative IDs are valid and not identical to the primary choice;
- required explanation factor groups are present;
- referenced evidence IDs are valid;
- unverified model warnings are not surfaced as trusted facts.

Invalid provider output falls back instead of bypassing validation.

### 10.4 Modes

The response exposes one of the explicit operational modes:

- `live_ai`
- `cached_live_ai`
- `rules_fallback`
- `unavailable`

The fallback is deterministic application logic, not relabeled as live AI.

### 10.5 Cache and invalidation key

The recommendation cache key hashes the current profile/facts, workspace version, locale, model and prompt version. A state/profile change therefore generates a different recommendation fact hash.

### 10.6 Direct API vs judge gateway

If `OPENAI_API_KEY` is configured and AI mode is not offline, the application can call the provider directly.

Otherwise it can use `JUDGE_GATEWAY_URL`. The gateway client sends a restricted employee/history/goal payload to `/api/judge/recommend`; it does not forward an arbitrary user prompt or arbitrary model URL.

If remote AI is unavailable, the local rules fallback remains available.

## 11. Completion workflow

There are two related mechanisms:

### Direct completion

```http
POST /api/completions
```

This is protected by reviewer authorization in the workflow.

### Employee completion request

```http
POST /api/completion-requests
POST /api/completion-requests/:id/accept
```

An employee can submit evidence; an authorized reviewer accepts it.

Completion logic verifies:

- the catalog event exists;
- mandatory assignments exist when required;
- optional activity is currently available;
- scheduled activities use a real catalog session;
- the session date is not in the future relative to the demo analysis date;
- duplicate credit is prevented through a workspace guard.

After a valid completion, the server recalculates skill state and can credit XP based on the verified change.

## 12. Side-quest workflow

The side-quest API supports a multi-stage workflow:

```text
employee submit
    ↓
advisor review
    ↓
resource approval (optional)
    ↓
policy approval (optional)
    ↓
employee evidence
    ↓
advisor acceptance
    ↓
credit + XP + audit
```

Endpoints:

```text
POST /api/side-quests
POST /api/side-quests/:id/resubmit
POST /api/side-quests/:id/review
POST /api/side-quests/:id/resource
POST /api/side-quests/:id/policy
POST /api/side-quests/:id/evidence
POST /api/side-quests/:id/accept
```

Important integrity properties:

- gains/caps must reference known skills;
- advisor-approved proposal does not itself grant skill credit;
- evidence cannot be accepted before all required approvals;
- accepted evidence cannot be reused for a second credit;
- self-approval is restricted;
- accepted credit uses an idempotency guard.

## 13. Assignments and help requests

Managers/HR can create assignments through:

```http
POST /api/assignments
```

The server validates scope, event existence, due date, audience and duplicate/incompatible assignment state.

Employees can submit help requests through:

```http
POST /api/help
```

Permitted manager/advisor/HR identities can resolve them through:

```http
POST /api/help/:id/resolve
```

## 14. Import pipeline

HR import is explicitly two-phase:

```http
POST /api/import/preview
POST /api/import/commit
```

`validateImport` accepts the supported JSON/CSV-derived structures and validates employee/history references. The commit endpoint re-runs validation and refuses an invalid import instead of committing a partially valid subset.

The included example is:

```text
data/demo/import-example.json
```

Imported history becomes baseline history; it is not treated as a retroactive XP source.

## 15. Rewards and idempotency

The demo has a reward ledger exposed by:

```http
GET /api/rewards
POST /api/rewards/:id/redeem
```

Reward redemption requires an `idempotency_key`. Reuse of the same key for a different reward is rejected. The server verifies balance and uses a workspace guard to prevent duplicate processing.

These reward definitions are demo product policy, not a representation of a bank production rewards program.

## 16. Audit

State-changing workflows call the server audit helper. HR and supervisor roles can read recent audit events through:

```http
GET /api/audit
```

The audit log is intended to make the review/approval path inspectable during the demo.

## 17. Localization

The UI and server support:

- Russian (`ru`)
- Kazakh (`kk`)
- English (`en`)

The client sends the selected locale. The server normalizes `Accept-Language` and localizes controlled server/import/recommendation messages while preserving user/source proper names where appropriate.

Localization consistency is covered by dedicated tests in `tests/*i18n*.test.ts`, `tests/locale-*.test.ts` and `tests/client-api-locale.test.ts`.

## 18. HTTP/security controls

The server includes the following controls in `src/server/app.ts` and related helpers:

- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: same-origin`;
- `Cache-Control: no-store` for API responses;
- same-origin validation for non-GET/HEAD/OPTIONS requests when an Origin header is present;
- JSON body size limit of 2 MB;
- server-generated request IDs in API error envelopes;
- HTTP-only demo session cookie;
- workspace isolation;
- server-side RBAC/scope checks;
- Zod validation;
- state idempotency guards;
- restricted AI/gateway contracts.

These controls strengthen the demo but do not replace a production identity provider, SSO, centralized secrets management, WAF/rate-limit infrastructure or enterprise audit platform.

## 19. API summary

### Session/demo

```text
GET  /api/session
POST /api/session/switch
POST /api/demo/reset
POST /api/demo/date
```

### Catalog/profile/development

```text
GET  /api/catalog
GET  /api/employees
GET  /api/employees/:id/profile
PUT  /api/employees/:id/goal
GET  /api/employees/:id/roadmap
POST /api/employees/:id/preview
POST /api/employees/:id/recommendations
POST /api/plan
```

### Completion and side quests

```text
POST /api/completions
GET  /api/completion-requests
POST /api/completion-requests
POST /api/completion-requests/:id/accept
GET  /api/side-quests
POST /api/side-quests
POST /api/side-quests/:id/resubmit
POST /api/side-quests/:id/review
POST /api/side-quests/:id/resource
POST /api/side-quests/:id/policy
POST /api/side-quests/:id/evidence
POST /api/side-quests/:id/accept
```

### Organization/HR

```text
GET  /api/help
POST /api/help
POST /api/help/:id/resolve
POST /api/assignments
GET  /api/hr/analytics
POST /api/import/preview
POST /api/import/commit
GET  /api/audit
```

### Rewards and AI support

```text
GET  /api/rewards
POST /api/rewards/:id/redeem
POST /api/external/search
POST /api/judge/recommend
```

## 20. Environment and configuration

Copy `.env.example` only when overrides are needed:

```bash
cp .env.example .env
```

Reference:

```dotenv
PORT=3000
DATABASE_PATH=.runtime/career-quest.sqlite
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
AI_BUDGET_USD=30
DEMO_ENABLED=true
JUDGE_GATEWAY_URL=https://career.aiviom.ai
# AI_MODE=offline
```

Additional deployment variables used by the code/config include `HOST`, `TRUST_PROXY`, `NODE_ENV`, and `RELEASE_SHA`.

## 21. Local installation and execution

```bash
git clone https://github.com/BAITC-Hacks/hack-6ee0248f-aiviom.git
cd hack-6ee0248f-aiviom
npm ci
npm run build
npm start
```

Open:

```text
http://127.0.0.1:3000
```

Health:

```bash
curl http://127.0.0.1:3000/health
```

Development mode:

```bash
npm run dev
```

## 22. Docker deployment

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

Open:

```text
http://127.0.0.1:3500
```

Inspect:

```bash
docker compose ps
docker compose logs -f web
curl http://127.0.0.1:3500/health
```

Restart without deleting data:

```bash
docker compose restart web
```

Stop without deleting data:

```bash
docker compose down
```

Destructive volume removal, only when intended:

```bash
docker compose down -v
```

## 23. Verification commands

```bash
npm test
npm run typecheck
npm run build
npm run verify:source
```

The repository's tests cover domain rules, API/RBAC, workspace isolation, transactional behavior, completion/quest idempotency, imports, recommendations, AI cache/fallback validation and localization.

For a manual functional review, use `docs/13_REVIEWER_GUIDE.md` and `docs/DEMO_API.md`.

## 24. Recommended main reviewer scenario

1. Open **https://career.aiviom.ai** or the local server.
2. As employee, inspect target/gaps/roadmap.
3. Generate recommendation and inspect its `mode` and explanation.
4. Preview an event and confirm state does not change.
5. Submit a completion request.
6. Switch to advisor and accept it.
7. Return to employee and verify skill/XP impact and no duplicate credit.
8. Submit a side quest; process advisor/resource/policy approvals as applicable; submit evidence; accept it.
9. Switch to manager/supervisor and inspect their scoped workflows.
10. Switch to HR, inspect analytics, preview+commit `data/demo/import-example.json`, and inspect audit.
11. Restart the application and verify persistence.

## 25. Production boundary

The implementation is intentionally self-contained for hackathon/reviewer reproduction. A production rollout would require decisions and infrastructure beyond this repository, including enterprise authentication/SSO, managed database/backup strategy, centralized secrets, observability, deployment automation, privacy/governance controls, production rate limiting and operational ownership.

The repository should therefore be evaluated as a working competition solution with explicit demo constraints, not as a claim of completed enterprise production infrastructure.
