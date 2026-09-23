import type { Candidate, Credit, Dataset, Employee, Event, Gain, Gap, Goal, History, Levels, Preview, Profile, RoleProfile } from '../shared/types.js';

export const DATA_AS_OF = '2026-10-01';
export const PRIORITY_VERSION = 'v1';
export const PRIORITY_WEIGHTS = Object.freeze({ U: 0.40, K: 0.25, H: 0.15, E: 0.10, B: 0.10 });
const GRADES = ['Junior', 'Middle', 'Senior', 'Lead'] as const;
const NEGATIVE_STATUSES = new Set(['dropped', 'no_show', 'declined']);

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function applyGains(before: Levels, gains: Gain[]): { after: Levels; deltas: Levels } {
  const after = { ...before };
  const deltas: Levels = {};
  for (const { skill_id, gain, max_level } of gains) {
    const current = after[skill_id] ?? 0;
    if (![current, gain, max_level].every(Number.isFinite) || current < 0 || current > 5 || gain < 0 || max_level < 0 || max_level > 5) {
      throw new Error(`Invalid gain for ${skill_id}`);
    }
    const delta = Math.max(0, Math.min(gain, max_level - current, 5 - current));
    after[skill_id] = current + delta;
    deltas[skill_id] = (deltas[skill_id] ?? 0) + delta;
  }
  return { after, deltas };
}

export function findTarget(dataset: Dataset, employee: Employee, override?: Goal | null): { goal: Goal | null; source: string; target: RoleProfile | null } {
  let goal: Goal | null;
  let source: string;
  if (override !== undefined) {
    goal = override;
    source = override ? 'selected' : 'none';
  } else if (employee.career_goal) {
    goal = employee.career_goal;
    source = 'career_goal';
  } else {
    const next = GRADES[GRADES.indexOf(employee.grade) + 1];
    goal = next && dataset.role_profiles.some(p => p.role === employee.role && p.grade === next)
      ? { target_role: employee.role, target_grade: next } : null;
    source = goal ? 'next_grade' : 'none';
  }
  const target = goal ? dataset.role_profiles.find(p => p.role === goal.target_role && p.grade === goal.target_grade) ?? null : null;
  if (goal && !target) throw new Error(`Unknown goal profile: ${goal.target_role}/${goal.target_grade}`);
  return { goal, source: target ? source : 'none', target };
}

export function gapsFor(dataset: Dataset, skills: Levels, target: RoleProfile | null): { gaps: Gap[]; coverage: number | null; total_gap: number; critical_met: number; critical_total: number } {
  if (!target || Object.keys(target.required_skills).length === 0) return { gaps: [], coverage: null, total_gap: 0, critical_met: 0, critical_total: 0 };
  const names = new Map(dataset.skills.map(s => [s.skill_id, s.name]));
  const entries = Object.entries(target.required_skills).filter(([, required]) => required > 0);
  const denominator = entries.reduce((n, [, required]) => n + required, 0);
  if (denominator === 0) return { gaps: [], coverage: null, total_gap: 0, critical_met: 0, critical_total: 0 };
  const critical = new Set(target.critical_skills);
  const gaps = entries.map(([skill_id, required]) => ({
    skill_id, name: names.get(skill_id) ?? skill_id, current: skills[skill_id] ?? 0,
    required, gap: Math.max(0, required - (skills[skill_id] ?? 0)), critical: critical.has(skill_id),
  }));
  return {
    gaps,
    coverage: 100 * entries.reduce((n, [id, required]) => n + Math.min(skills[id] ?? 0, required), 0) / denominator,
    total_gap: gaps.reduce((n, g) => n + g.gap, 0),
    critical_met: gaps.filter(g => g.critical && g.gap === 0).length,
    critical_total: gaps.filter(g => g.critical).length,
  };
}

export function effectiveCompletedAt(record: History): { date: string; quality: 'exact' | 'proxy' } {
  return record.completed_at && validDate(record.completed_at)
    ? { date: record.completed_at, quality: record.completion_time_quality === 'exact' ? 'exact' : 'proxy' }
    : { date: record.date, quality: 'proxy' };
}

export function skillsAt(dataset: Dataset, employee: Employee, asOf: string, credits: Credit[] = []): { skills: Levels; provenance: Profile['provenance'] } {
  const eventMap = new Map(dataset.events.map(e => [e.event_id, e]));
  // Source/import history on the review date is already included in the reviewed baseline.
  // Only a trusted application credit written after that review can be replayed on that date.
  const afterReview = (date: string, applicationCredit?: boolean) =>
    date > employee.last_review_date || date === employee.last_review_date && applicationCredit === true;
  const completions = dataset.history.filter(h => h.employee_id === employee.employee_id && h.status === 'completed')
    .map(h => ({ history: h, ...effectiveCompletedAt(h) }))
    .filter(h => validDate(h.date) && afterReview(h.date, h.history.application_credit) && h.date <= asOf);
  const appliedRecordIds = new Set(completions.map(c => c.history.record_id));
  const actions = [
    ...completions.map(c => ({ id: c.history.record_id, date: c.date, quality: c.quality, gains: eventMap.get(c.history.event_id)?.develops_skills ?? [] })),
    ...credits.filter(c => c.employee_id === employee.employee_id && validDate(c.completed_at) && afterReview(c.completed_at, c.application_credit) && c.completed_at <= asOf && !appliedRecordIds.has(c.source_id))
      .map(c => ({ id: c.credit_id, date: c.completed_at, quality: 'exact' as const, gains: c.gains })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  let skills = { ...employee.skills };
  for (const action of actions) skills = applyGains(skills, action.gains).after;
  return { skills, provenance: actions.map(a => ({ record_id: a.id, date: a.date, quality: a.quality })) };
}

export function audienceAllows(event: Event, employee: Employee): boolean {
  return event.target_roles.includes(employee.role) && event.target_grades.includes(employee.grade);
}

export function prerequisitesMet(event: Event, skills: Levels): boolean {
  return Object.entries(event.prerequisites).every(([id, required]) => (skills[id] ?? 0) >= required);
}

export function nextSession(event: Event, asOf: string, history: History[] = []): string | null {
  if (event.format === 'self_paced') return null;
  const completedSessions = new Set(history.filter(h => h.event_id === event.event_id && h.status === 'completed').map(h => h.date));
  return [...event.upcoming_sessions].filter(s => validDate(s) && s >= asOf && !completedSessions.has(s)).sort()[0] ?? null;
}

export function eventRepeatBlocked(event: Event, history: History[], session: string | null): boolean {
  if (event.event_id !== 'EV_036') return history.some(h => h.event_id === event.event_id && h.status === 'completed');
  return session === null || history.some(h => h.event_id === event.event_id && h.status === 'completed' && h.date === session);
}

function historySimilarity(history: History[], event: Event, events: Map<string, Event>, asOf: string): { H: number; evidence: string[] } {
  const cutoff = new Date(`${asOf}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 180);
  const since = cutoff.toISOString().slice(0, 10);
  const similar = history.filter(h => h.date >= since && h.date <= asOf && !events.get(h.event_id)?.mandatory &&
    events.get(h.event_id)?.type === event.type && events.get(h.event_id)?.format === event.format);
  const completed = similar.filter(h => h.status === 'completed').length;
  const negative = similar.filter(h => NEGATIVE_STATUSES.has(h.status)).length;
  return { H: (completed + 1) / (completed + negative + 2), evidence: similar.map(h => h.record_id) };
}

function usefulAfterGain(event: Event, skills: Levels, gaps: Gap[]): boolean {
  const after = applyGains(skills, event.develops_skills).after;
  return gaps.some(g => Math.min(g.gap, (after[g.skill_id] ?? 0) - (skills[g.skill_id] ?? 0)) > 0);
}

export function buildCandidates(dataset: Dataset, employee: Employee, skills: Levels, history: History[], gaps: Gap[], asOf: string): Candidate[] {
  const eventMap = new Map(dataset.events.map(e => [e.event_id, e]));
  const candidates: Candidate[] = dataset.events.filter(e => !e.mandatory).map(event => {
    const relevantHistory = history.filter(h => h.event_id === event.event_id);
    const continuing = relevantHistory.some(h => h.status === 'in_progress');
    const session = nextSession(event, asOf, relevantHistory);
    const reasons: string[] = [];
    if (!audienceAllows(event, employee)) reasons.push('audience_blocked');
    if (!prerequisitesMet(event, skills)) reasons.push('prerequisites_blocked');
    if (event.format !== 'self_paced' && !session && !continuing) reasons.push('no_session');
    if (eventRepeatBlocked(event, relevantHistory, session) && !continuing) reasons.push('already_completed');
    const { after, deltas } = applyGains(skills, event.develops_skills);
    const U = gaps.reduce((n, g) => n + Math.min(g.gap, deltas[g.skill_id] ?? 0), 0);
    const K = gaps.reduce((n, g) => n + (g.critical ? Math.min(g.gap, deltas[g.skill_id] ?? 0) : 0), 0);
    const E = event.duration_hours > 0 ? U / event.duration_hours : null;
    const B = dataset.events.filter(other => other.event_id !== event.event_id && !other.mandatory &&
      audienceAllows(other, employee) && !eventRepeatBlocked(other, history.filter(h => h.event_id === other.event_id), nextSession(other, asOf, history)) &&
      (other.format === 'self_paced' || nextSession(other, asOf, history) !== null) &&
      !prerequisitesMet(other, skills) && prerequisitesMet(other, after) && usefulAfterGain(other, after, gaps)).length;
    const { H, evidence } = historySimilarity(history, event, eventMap, asOf);
    return { event, eligible: reasons.length === 0 || continuing && reasons.every(r => r === 'no_session' || r === 'already_completed'),
      reasons, session: continuing ? relevantHistory.find(h => h.status === 'in_progress')?.date ?? session : session,
      continuing, deltas, U, K, E, B, H, priority: 0, evidence_ids: evidence };
  });
  const pool = candidates.filter(c => c.eligible);
  const max = { U: Math.max(0, ...pool.map(c => c.U)), K: Math.max(0, ...pool.map(c => c.K)), E: Math.max(0, ...pool.map(c => c.E ?? 0)), B: Math.max(0, ...pool.map(c => c.B)) };
  const n = (value: number, maxValue: number) => maxValue > 0 ? value / maxValue : 0;
  for (const c of candidates) c.priority = c.eligible ? 100 * (
    PRIORITY_WEIGHTS.U * n(c.U, max.U) + PRIORITY_WEIGHTS.K * n(c.K, max.K) +
    PRIORITY_WEIGHTS.H * c.H + PRIORITY_WEIGHTS.E * n(c.E ?? 0, max.E) + PRIORITY_WEIGHTS.B * n(c.B, max.B)
  ) : 0;
  return candidates.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.priority - a.priority || a.event.event_id.localeCompare(b.event.event_id));
}

export function buildProfile(dataset: Dataset, employeeId: string, options: { asOf?: string; goal?: Goal | null; credits?: Credit[] } = {}): Profile {
  const employee = dataset.employees.find(e => e.employee_id === employeeId);
  if (!employee) throw new Error(`Unknown employee: ${employeeId}`);
  const as_of = options.asOf ?? DATA_AS_OF;
  if (!validDate(as_of)) throw new Error(`Invalid asOf: ${as_of}`);
  const { goal, source, target } = findTarget(dataset, employee, options.goal);
  const { skills, provenance } = skillsAt(dataset, employee, as_of, options.credits ?? []);
  const gapMetrics = gapsFor(dataset, skills, target);
  const history = dataset.history.filter(h => h.employee_id === employeeId && h.date <= as_of &&
    (h.status !== 'completed' || effectiveCompletedAt(h).date <= as_of));
  const candidates = buildCandidates(dataset, employee, skills, history, gapMetrics.gaps, as_of);
  const mandatory = history.filter(h => dataset.events.some(e => e.event_id === h.event_id && e.mandatory) && h.status !== 'completed');
  const useful = candidates.filter(c => c.eligible && (c.U > 0 || c.B > 0));
  let no_next_reason: string | null = null;
  if (!target) no_next_reason = 'goal_missing';
  else if (gapMetrics.total_gap === 0) no_next_reason = 'goal_skills_met';
  else if (useful.length === 0) {
    const relevant = candidates.filter(c => c.U > 0 || c.B > 0);
    no_next_reason = ['prerequisites_blocked', 'audience_blocked', 'no_session'].find(r => relevant.some(c => c.reasons.includes(r))) ?? 'catalog_gap';
  }
  return { employee, as_of, skills, goal, goal_source: source, ...gapMetrics, history, provenance, candidates, mandatory, no_next_reason };
}

export function previewEvent(dataset: Dataset, profile: Profile, eventId: string): Preview {
  const event = dataset.events.find(e => e.event_id === eventId);
  if (!event) throw new Error(`Unknown event: ${eventId}`);
  const before = { ...profile.skills };
  const { after, deltas } = applyGains(before, event.develops_skills);
  const target = profile.goal ? dataset.role_profiles.find(p => p.role === profile.goal?.target_role && p.grade === profile.goal?.target_grade) ?? null : null;
  const coverage_before = gapsFor(dataset, before, target).coverage;
  const coverage_after = gapsFor(dataset, after, target).coverage;
  const unlocked_event_ids = dataset.events.filter(e => !e.mandatory && e.event_id !== eventId && audienceAllows(e, profile.employee) &&
    !prerequisitesMet(e, before) && prerequisitesMet(e, after) &&
    (e.format === 'self_paced' || nextSession(e, profile.as_of, profile.history) !== null) &&
    !eventRepeatBlocked(e, profile.history, nextSession(e, profile.as_of, profile.history))).map(e => e.event_id);
  return { before, after, deltas, coverage_before, coverage_after, unlocked_event_ids };
}
