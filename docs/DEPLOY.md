# Current final deployment

Current final artifact: tag `must-have-2026-09-23`, exact runtime SHA at https://career.aiviom.ai/health. Tested application SHA and receipts: RELEASE_MANIFEST.json. The owner designates current main as the submission; older tags below are preserved historical checkpoints.

Before this release a consistent SQLite backup passed quick_check: `/home/alex/career-quest/backups/pre-must-have-20260923T1210/career-quest.sqlite`, SHA256 `3738f28f84414a40b5a329c9372854c02dae2bc6b1f28b685b33ec4cacb03747`. Stable image `career-quest:909a80168eff6a5f1c501d2bf0ed0dd0bef6722e` remains available. Only project `career-quest`, service `web`, was rebuilt/recreated with its existing volume; no Caddy or foreign container changes. Roll back code by recreating only web from that prior release directory and RELEASE_SHA; preserve current DB rather than overwriting it.

Below is the historical deployment log, not a command to repeat shared-proxy changes.

# Isolated deployment
Target authorized by captain: 34.165.120.4, Ubuntu22 x86_64. New directory /home/alex/career-quest, Compose project career-quest, 127.0.0.1:3500 -> app3000, volume career-quest_career_quest_data. No other project commands, cleanup or volume operations.
Preflight 2026-09-23 09:10UTC: disk41GB available, RAM19Gi available; port3500 free. Common Caddy /home/alex/EDGE_PROXY/Caddyfile, edge-proxy-caddy2.9.1, admin off. Captain explicitly approved one restart after validate on Sep23.
Exact route addition:
```
career.aiviom.ai {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3500
}
```
Before applying: record old hash and copy backup inside new project; diff addition only; validate inside existing Caddy container; new app health200 first. Then restart only edge-proxy-caddy once, verify career HTTPS/health and existing public domain baseline. Do not claim deployed until checked. On failure restore backup and ask before additional shared restart unless necessary for authorized rollback.
Deploy artifact uses git archive of a checked commit; .env transferred privately, never git. Docker build only new project. Record RELEASE_SHA and verify health. Updates rebuild only career-quest web. SQLite volume preserved.

Final deployment: c2c84d7 built and healthy on port3500. Legacy lexora-prod-caddy was discovered also binding80/443 with host networking; owner explicitly authorized stopping it (not deleting). A second edge-proxy-caddy restart was separately authorized for certificate issuance after resolving that conflict. Do not restart legacy proxy without resolving the port conflict. Existing silte upstream127.0.0.1:3402 is not listening; outside Career Quest scope.

HTTPS career.aiviom.ai and health PASS. Independent clean clone live gateway PASS in6244ms. Existing tenly.ink, aiviom.ai, kabiden-azat.ink, dogslabs.org and lexora.dogslabs.org returned200 after proxy correction.


## Atlas rollout boundary

The Atlas release preserves the original submission separately. On 2026-09-23 at 11:18 UTC the owner explicitly requested immediate deployment and integration into main, superseding the earlier 18:00 restriction. Preserve submission tag and SHA above; never rewrite them. Existing production is image `career-quest:1c397c1f0c10652707e34d9d0f3d4776eda0e97b`, Compose directory `/home/alex/career-quest/releases/1c397c1` (read-only rechecked 2026-09-23 11:01 UTC).

Deploy only an exact checked Git archive to a new release directory under `/home/alex/career-quest/releases`. Reuse the private `/home/alex/career-quest/.env` without printing it. Build a SHA-tagged image; keep the preceding image. Before activation take a consistent SQLite backup using SQLite backup API into the project-private backup area and record old image/health/digest. No business schema migration is required.

At activation, run Compose only inside the new Career Quest directory, project `career-quest`, service `web`, with the existing named volume and loopback port3500. Never run project-wide down, prune, delete volumes, change Caddy or operate foreign containers. Check loopback and HTTPS health report the exact new SHA; then assets/fonts, session, localized API errors, roles, import and real recommendations. Check an old submission clone can still call the gateway. On regression recreate only web with the previous image and preserved volume. Do not overwrite the live DB with a backup merely to roll back application code.

Any scheduled continuation must recheck actual time, current production SHA and Git main before activation; stop on unexpected concurrent changes. Main may fast-forward to the checked release under the owner’s immediate deployment request. The captain submits the organizer form; deploying Atlas does not alter that submission.

## Immediate Atlas activation receipt

Owner superseded the time restriction on 2026-09-23 at 11:18 UTC. Initial Atlas artifact f68be3b became healthy and passed HTTPS, five roles, import/RBAC, assets, live RU/KK/EN and old-client gateway checks. Backup: `/home/alex/career-quest/backups/pre-atlas-f68be3b-20260923T1120/career-quest.sqlite`, SHA256 `1807af3e86ee6cca427e83a3e26896a0f3a963279746d9e0f1b0ca83ae46f2ca`. The previous submission image remains for rollback. Final tag `atlas-2026-09-23` includes the verified documentation; runtime reports the full release SHA at `/health`. No shared proxy changes or foreign-container operations were performed.
