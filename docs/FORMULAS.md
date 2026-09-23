# Domain formulas and data policy

`src/domain` is the single source for profile calculations. Default domain date is `2026-10-01`; callers can pass an explicit demo date. It never reads wall-clock time. Source files in `data/source` are read without modification. Import validation returns normalized new rows; persistence and atomic commit belong to the server.

## Skill state and goal

Per the source dataset README, an omitted skill means level 0, not a missing measurement. This explicit source-schema rule is also used for imports of that schema; unrelated unknown dates, costs, durations and denominators are not converted to zero.

The employee's `skills` are the review baseline. For each `completed` history record with effective completion date strictly after `last_review_date` and no later than `as_of`, apply event gains in `(effective date, stable ID)` order. `completed_at` is exact when supplied; otherwise historical `date` is a **proxy** and provenance says so. A historical completion on the review date is already in baseline. An application-confirmed completion on that same day is applied only when the trusted server has set `application_credit: true`; imported/source history cannot set this marker. In-progress, declined, dropped, no-show and overdue records give no gain. Separate approved side-quest credits use the same date rule and trusted marker; a credit whose `source_id` equals an already applied history `record_id` is ignored to avoid duplicate gain.

For each gain, `delta = max(0, min(gain, max_level - current, 5 - current))`. Levels must be 0–5, gains nonnegative and caps 0–5. A cap below current level never lowers a skill.

Goal selection: explicit `goal` option (including `null`), else `career_goal`, else next grade in the same role when that role profile exists. Lead with no goal has no inferred next grade. Only positive required levels count. `gap_s = max(0, required_s - current_s)`; `coverage = 100 × sum(min(current_s, required_s)) / sum(required_s)`. A missing goal or zero denominator yields `null` coverage. `critical_met` counts critical required skills with zero gap. Skill coverage is not a promotion decision.

## Eligibility, candidate ranking and preview

Mandatory records are separate from voluntary candidate recommendations. New catalog activity must match current role and grade, all prerequisites, available session (except self-paced), and repeat rule. Completed activity does not repeat except `EV_036`, whose next session must differ from completed sessions. In-progress activities are marked `continuing` so a new enrollment is not created. Past history is never rejected because the employee's current grade differs from their past grade. Work format alone is not a hard block.

For event `e`, compute marginal `delta_s` from a copy of current skills. `U` is summed useful gap closure, `K` is useful closure in critical skills, `E = U / duration_hours` for positive duration else `null`, `B` counts newly unlocked useful events that satisfy audience, session and repeat rules. Similar history is voluntary activity of same type and format within 180 days. `H = (completed + 1) / (completed + dropped + no_show + declined + 2)`; other statuses do not enter the denominator. `H` is a heuristic signal, not a predicted probability or performance judgement. Normalize U, K, E and B by the maximum among eligible candidates, with zero when the maximum is zero. Priority version `v1` is `100 × (0.40 N(U) + 0.25 N(K) + 0.15 H + 0.10 N(E) + 0.10 N(B))`; ties use `event_id`.

Preview applies gains to a copy, reports before/after, coverage before/after and newly unlocked event IDs. It has no persistence side effect. A preview does not certify completion or give XP.

## Roadmap

Milestones are required skills, not mandatory courses. A bounded beam search works on copied skills and keeps prerequisite order, real catalog audience, repeat rules and session chronology. It explores at most 8 events and 512 states, retaining the best 24 states at each depth. `EV_036` may appear more than once only on distinct listed sessions. Objective: close total and critical gaps with a short route; stable event-ID tie break. If pruning or a state limit prevents exhaustive search, `search_limited` is true. `remaining_gaps` are after the selected projected path, never real profile state. Selected steps are `planned` or `in_progress`; relevant unavailable alternatives may appear as `blocked`. `plan_hours` sums selected event durations. With positive weekly budget, `weeks_lower_bound = ceil(plan_hours / budget)`, otherwise `null`. The bound excludes session waits and approvals.

## Import

Employee input accepts a single profile, array or `{employees:[...]}` wrapper. History accepts CSV, array or `{history:[...]}` wrapper. Empty CSV numeric cells become `null`. Validation checks required fields, ISO dates, levels, ranges, statuses, role/grade, skill/event references, duplicate IDs and duplicate voluntary completions. `EV_036` uses a unique session key. An identical existing ID is a no-op warning; conflicting content is an error. A manager ID absent from current and incoming employees is retained with an unresolved warning. `counts` describe newly accepted rows; when `valid=false`, the server must reject the whole atomic commit. No imported rows are written by this module.

## Analytics shape

`buildAnalytics(dataset, profiles, asOf)` takes **already scoped** profiles; the caller enforces workspace and RBAC. It returns JSON-ready aggregates plus scoped drill-down records. The HR report contains employee IDs/names for concrete blockers and open assignments, but never ranks employees:

| Key | Fields | Denominator |
|---|---|---|
| `scope` | `profiles`, `history_records` | Supplied profiles and their history through `as_of` |
| `skill_gaps[]` | `skill_id`, `name`, `requiring`, `with_gap`, `frequency_pct`, `average_gap`, `critical_with_gap` | Profiles requiring the skill |
| `critical_gaps` | `employees` | Profiles with at least one open critical gap |
| `completions` | `total`, `completed`, `rate_pct`, `by_status` | History records in selected cohort |
| `no_show` | `eligible`, `no_show`, `rate_pct` | Occurred scheduled sessions with completed/in_progress/dropped/no_show status |
| `mandatory_overdue` | `count` | Mandatory non-completed records with due date before `as_of` |
| `no_next_step` | `total`, `by_reason` | Profiles with defined goal and gap but no useful eligible step |
| `no_voluntary_completion_90d` | `count` | Hired at least 90 days ago, with no completed voluntary activity in the window |
| `catalog_gaps[]` | `skill_id`, `name`, `with_gap`, `with_next_step`, `without_next_step`, `by_reason`, `affected_employees[]`; `employees` aliases `without_next_step` | Employee-skill pairs with open gap |
| `participation_breakdown` | `mandatory`, `voluntary`: `total`, `completed`, `completion_pct`, `no_show`, `declined`, `overdue`, `by_status` | History records in each assignment category |
| `event_groups[]` | `event_id`, `title`, `employees` | Unique profiles for whom event is eligible and useful |
| `on_time` | `eligible`, `on_time`, `rate_pct` | Completed records with **exact** `completed_at` and `due_date` |
| `no_next_employees[]` | `employee_id`, `full_name`, `reason` | Scoped profiles with a concrete next-step blocker |
| `mandatory_open[]` | `employee_id`, `event_id`, `title`, `due_date`, `status` | Scoped non-completed mandatory records |
| `participation[]` | `event_id`, `title`, `total`, `completed`, `by_status` | Scoped history records per activity |

All zero-denominator rates are `null`. The caller must select the report period/cohort; the default here is all records through `as_of`. `catalog_gaps` counts every open employee-skill pair with `with_gap`, `with_next_step`, `without_next_step`, `by_reason`, and scoped `affected_employees[]`; legacy `employees` aliases `without_next_step`. A skill with one covered and one blocked employee remains visible. Reasons are `prerequisites_blocked`, `audience_blocked`, `no_session`, or `catalog_gap`. `participation_breakdown` separately reports mandatory and voluntary `total`, `completed`, `completion_pct`, `no_show`, `declined`, `overdue`, and `by_status`; mandatory overdue includes non-completed records past due. `catalog_gaps` is a direct-coverage signal, not a proof that no prerequisite path exists. `caveats` in the response state those limitations.

Roadmap calendar ordering uses an explicit conservative serial-effort estimate of ceil(duration_hours * 7 / weekly_budget) calendar days per activity before the next step; session dates remain original catalog dates. This is a planning estimate, not proof of actual course delivery duration. Missing weekly budget leaves calendar duration unknown. Milestone availability uses the same current eligibility and positive capped gains as recommendations.

Each roadmap step includes source title and hours, projected per-skill before/after levels and target-gap reduction, and catalog IDs newly unlocked by its prerequisite gain. These are projections; only confirmed completion updates the real profile.
