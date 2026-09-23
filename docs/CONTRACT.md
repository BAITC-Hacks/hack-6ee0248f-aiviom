# Shared contract v1
Coordinator owns src/shared/types.ts. Writers request changes rather than editing it. Domain exports from src/domain/index.ts:
- loadSourceDataset(sourceDir?:string): Dataset (default cwd/data/source)
- buildProfile(dataset:Dataset, employeeId:string, options?:{asOf?:string,goal?:Goal|null,credits?:Credit[]}): Profile
- previewEvent(dataset:Dataset,profile:Profile,eventId:string): Preview
- buildRoadmap(dataset:Dataset,profile:Profile,weeklyBudget?:number): Roadmap
- buildAnalytics(dataset:Dataset,profiles:Profile[],asOf:string): JSON-ready object; document shape
- validateImport(dataset:Dataset,input:unknown): {valid:boolean,errors:{row:number,field:string,message:string}[],warnings:string[],employees:Employee[],history:History[],counts:{employees:number,history:number}}
Domain owns all skill calculations, eligibility, gain/cap, priority, roadmap, import validation. Does NOT own persistence. Import input {employees: wrapper/array/single, history: CSV string/array}; allow source wrapper.
AI exports src/ai/index.ts recommend(profile:Profile,options?:{apiKey?:string,model?:string,locale?:string}):Promise<RecommendationResult>. AI cache keyed full profile facts/model/locale; invalidation naturally facts based. AI receives eligible candidates; validate output IDs/evidence/factors. Only server resolves key. Environment OPENAI_MODEL default gpt-5.4-mini. Offline honest fallback. AI budget and rate limit owned server. AI writer may implement safe external search helper requiring only skill metadata.

## HTTP envelopes
Success JSON direct. Errors {code,user_message,retryable,request_id}. fetch same origin with cookies. POST JSON. Server-generated httpOnly session ties workspace + selected demo identity; role never accepted in mutations.
GET /api/session -> {workspace_id,as_of,identity,identities:Identity[],version,ai_available}
POST /api/session/switch {identity_id} -> session. POST /api/demo/reset -> session.
GET /api/catalog -> {events,skills,role_profiles}
GET /api/employees -> {employees:Employee[]} scoped
GET /api/employees/:id/profile -> Profile + {xp:number,balance:number,personal_level:number,plan_progress:number|null,weekly_budget:number,plan_items:string[],help_requests:object[]}
PUT /api/employees/:id/goal {goal:Goal|null,weekly_budget?:number} -> profile
GET /api/employees/:id/roadmap -> Roadmap
POST /api/employees/:id/recommendations -> RecommendationResult
POST /api/employees/:id/preview {event_id} -> Preview
POST /api/plan {employee_id,event_id} -> {ok:true}
POST /api/completions {employee_id,event_id,session?:string,evidence:string,idempotency_key:string} -> {ok:true,duplicate:boolean,xp:number}; advisor/HR confirms completion; employee submits via POST /api/completion-requests same shape -> {ok:true}; GET /api/completion-requests -> {requests:object[]}; advisor POST /api/completion-requests/:id/accept {reason}.
GET /api/side-quests -> {quests:Quest[]}; POST /api/side-quests {title,description,deliverables,estimated_hours,source_url,skill_ids,requires_resource,requires_policy} -> Quest.
POST /api/side-quests/:id/review {action:'approve'|'revise'|'reject',reason,criteria,gains:Gain[]} -> Quest
POST /api/side-quests/:id/resource {action:'approve'|'reject',reason} -> Quest
POST /api/side-quests/:id/policy {action:'approve'|'reject',reason} -> Quest
POST /api/side-quests/:id/evidence {evidence} -> Quest
POST /api/side-quests/:id/accept {reason} -> Quest
POST /api/help {employee_id,reason,event_id?:string} -> {ok:true}; GET /api/help -> {requests:object[]}; POST /api/help/:id/resolve {reason}.
POST /api/assignments {employee_id,event_id,due_date} -> {ok:true}; manager/HR only.
GET /api/hr/analytics -> domain analytics; explicit localized UI columns, canonical machine keys unchanged. `caveat_codes` supplements legacy `caveats`.
POST /api/import/preview {employees,history} -> domain validation response
POST /api/import/commit {employees,history} -> {ok:true,counts,warnings}
GET /api/rewards -> {balance,earned,items:{id,title,cost,description}[],ledger:object[]}
POST /api/rewards/:id/redeem {idempotency_key} -> {ok:true}
GET /api/audit -> {events:object[]}; supervisor/HR scoped.
POST /api/demo/date {as_of} -> session (explicit simulated time only demo).

## Files and ownership
Domain: src/domain/** tests/domain*.test.ts docs/FORMULAS.md.
UI: src/client/** DESIGN.md .impeccable/** docs/UI*.md. index.html request coordinator changes.
AI: src/ai/** tests/ai*.test.ts docs/AI.md.
Coordinator: other files, dependency changes, DB, server, main, integration.

## Atlas release localization (backward-compatible)

`Locale = 'ru' | 'kk' | 'en'`. HTTP clients send `Accept-Language`; supported regional tags and quality weights are normalized, default is `ru`. All request language is presentation-only. Domain date and calculations never depend on language.

Recommendations and judge gateway propagate language, including offline/failure paths. The strict judge JSON input stays compatible: language travels in the header. Existing `reason`, factor keys and evidence IDs remain; optional `summary` and structured `facts[{id,factor,label,value}]` allow concise presentation without parsing prose. Response `locale` identifies its language. AI cache includes facts, workspace version, model, locale and prompt version. Changing UI language does not authorize an automatic paid request.

Errors retain `{code,user_message,retryable,request_id}` and may add `message_key` and safe `params`. Import row issues add `code` and `message_key`; warning details add controlled codes/parameters. Domain returns canonical codes and compatibility text; the server localizes presentation. UI shows translated field labels, never raw object dumps.

Catalog translations are separate from immutable source JSON and keyed by stable IDs. Recognized source fields are translated only while matching the source snapshot; unknown imported/edited content remains original. UI language persists locally; draft input is never translated or discarded on language change.
