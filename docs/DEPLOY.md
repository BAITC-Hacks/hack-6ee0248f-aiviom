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
