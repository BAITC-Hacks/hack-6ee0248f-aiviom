# Deployment guide

Public demo: **https://career.aiviom.ai**

This guide describes reproducible deployment from the current repository.

## 1. Prerequisites

Local Node deployment requires:

- Node.js >= 20.19 (Node 22 LTS recommended)
- npm
- Git
- internet access during `npm ci`

SQLite is embedded through `better-sqlite3`; no separate DB server is required.

If a prebuilt `better-sqlite3` binary is unavailable on the host, native compilation may require Python 3, make and a C/C++ compiler.

## 2. Local production-style run

```bash
git clone https://github.com/BAITC-Hacks/hack-6ee0248f-aiviom.git
cd hack-6ee0248f-aiviom
npm ci
npm run build
npm start
```

Default URL:

```text
http://127.0.0.1:3000
```

Health check:

```bash
curl http://127.0.0.1:3000/health
```

## 3. Environment

A `.env` file is optional for the basic demo.

To create one:

```bash
cp .env.example .env
```

Main values:

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

`HOST`, `TRUST_PROXY`, `NODE_ENV` and `RELEASE_SHA` are also consumed in deployment/server configuration.

Do not commit `.env` or API credentials.

## 4. Docker Compose

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

The supplied `compose.yml` publishes:

```text
127.0.0.1:3500 -> container:3000
```

Health:

```bash
curl http://127.0.0.1:3500/health
```

Status/logs:

```bash
docker compose ps
docker compose logs -f web
```

## 5. Persistence

Docker stores `.runtime` in the named volume `career_quest_data`.

Normal stop:

```bash
docker compose down
```

This preserves data.

Destructive removal:

```bash
docker compose down -v
```

This removes the persistent volume and must only be used when a full reset is intended.

For a local Node run, persistence is normally stored at:

```text
.runtime/career-quest.sqlite
```

## 6. Post-deployment verification

Run:

```bash
curl http://127.0.0.1:3000/health
# or, for Compose:
curl http://127.0.0.1:3500/health
```

Then open the browser and follow [`13_REVIEWER_GUIDE.md`](13_REVIEWER_GUIDE.md).

For source/build checks:

```bash
npm test
npm run typecheck
npm run build
npm run verify:source
```

## 7. Live AI options

The application remains usable without a personal API key.

Possible paths:

1. `OPENAI_API_KEY` configured on the server: direct live model call.
2. No local key, but `JUDGE_GATEWAY_URL` enabled: restricted team gateway path.
3. Remote AI unavailable or `AI_MODE=offline`: explicit rules fallback.

The application reports the recommendation mode so a fallback is not represented as live AI.

## 8. Reverse proxy / public deployment

For an internet-facing deployment, run the Node container behind a TLS-terminating reverse proxy and forward traffic to the loopback-bound Compose port. Set proxy trust only for the actual deployment topology (`TRUST_PROXY=1` is used by the supplied Compose environment).

The checked-in Compose file deliberately binds the published port to `127.0.0.1`, avoiding direct exposure of the Node process on all interfaces.

## 9. Operational checks

After deployment, verify:

- `/health` responds;
- the UI loads;
- `/api/session` creates/returns a workspace session;
- role switching works inside the demo workspace;
- state-changing actions survive application restart;
- demo reset resets only the current workspace;
- API keys are server-side only;
- `.env` and `.runtime` are not committed.
