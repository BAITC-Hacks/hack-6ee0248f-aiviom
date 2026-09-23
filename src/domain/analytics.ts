import type { Dataset, Profile } from '../shared/types.js';
import { effectiveCompletedAt, validDate } from './calculation.js';

const pct = (n: number, d: number): number | null => d ? 100 * n / d : null;

/** All rows are aggregates of the already scoped profiles supplied by the caller. */
export function buildAnalytics(dataset: Dataset, profiles: Profile[], asOf: string) {
  if (!validDate(asOf)) throw new Error(`Invalid asOf: ${asOf}`);
  const ids = new Set(profiles.map(p => p.employee.employee_id));
  const histories = dataset.history.filter(h => ids.has(h.employee_id) && h.date <= asOf &&
    (h.status !== 'completed' || effectiveCompletedAt(h).date <= asOf));
  const eventMap = new Map(dataset.events.map(e => [e.event_id, e]));
  const skillMap = new Map(dataset.skills.map(s => [s.skill_id, s.name]));
  const requiredIds = new Set(profiles.flatMap(p => p.gaps.map(g => g.skill_id)));
  const skill_gaps = [...requiredIds].sort().map(skill_id => {
    const requiring = profiles.flatMap(p => p.gaps.filter(g => g.skill_id === skill_id));
    const with_gap = requiring.filter(g => g.gap > 0).length;
    return { skill_id, name: skillMap.get(skill_id) ?? skill_id, requiring: requiring.length, with_gap,
      frequency_pct: pct(with_gap, requiring.length), average_gap: requiring.length ? requiring.reduce((n, g) => n + g.gap, 0) / requiring.length : null,
      critical_with_gap: requiring.filter(g => g.critical && g.gap > 0).length };
  });
  const by_status: Record<string, number> = {};
  histories.forEach(h => { by_status[h.status] = (by_status[h.status] ?? 0) + 1; });
  const completed = by_status.completed ?? 0;
  const occurredScheduled = histories.filter(h => {
    const event = eventMap.get(h.event_id);
    return event && event.format !== 'self_paced' && h.date < asOf && ['completed', 'in_progress', 'dropped', 'no_show'].includes(h.status);
  });
  const noShows = occurredScheduled.filter(h => h.status === 'no_show').length;
  const overdue = histories.filter(h => eventMap.get(h.event_id)?.mandatory && h.status !== 'completed' && h.due_date && h.due_date < asOf).length;
  const noNext: Record<string, number> = {};
  profiles.filter(p => p.no_next_reason && p.no_next_reason !== 'goal_skills_met' && p.no_next_reason !== 'goal_missing')
    .forEach(p => { noNext[p.no_next_reason!] = (noNext[p.no_next_reason!] ?? 0) + 1; });
  const date90 = new Date(`${asOf}T00:00:00Z`);
  date90.setUTCDate(date90.getUTCDate() - 90);
  const since90 = date90.toISOString().slice(0, 10);
  const noVoluntary = profiles.filter(p => p.employee.hire_date <= since90 && !histories.some(h => h.employee_id === p.employee.employee_id &&
    h.status === 'completed' && !eventMap.get(h.event_id)?.mandatory && effectiveCompletedAt(h).date >= since90 && effectiveCompletedAt(h).date <= asOf)).length;
  const timely = histories.filter(h => h.status === 'completed' && h.due_date && h.completed_at && h.completion_time_quality === 'exact');
  const onTime = timely.filter(h => h.completed_at! <= h.due_date!).length;
  const catalog_gaps = skill_gaps.filter(g => g.with_gap > 0 && !profiles.some(p => p.gaps.some(gap => gap.skill_id === g.skill_id && gap.gap > 0) &&
    p.candidates.some(c => c.eligible && (c.deltas[g.skill_id] ?? 0) > 0)))
    .map(g => ({ skill_id: g.skill_id, name: g.name, employees: g.with_gap }));
  const event_groups = dataset.events.filter(e => !e.mandatory).map(e => ({ event_id: e.event_id, title: e.title,
    employees: profiles.filter(p => p.candidates.some(c => c.event.event_id === e.event_id && c.eligible && (c.U > 0 || c.B > 0))).length }))
    .filter(e => e.employees > 0).sort((a, b) => b.employees - a.employees || a.event_id.localeCompare(b.event_id));
  return {
    no_next_employees: profiles.filter(p => p.no_next_reason && !['goal_skills_met','goal_missing'].includes(p.no_next_reason)).map(p => ({employee_id:p.employee.employee_id,full_name:p.employee.full_name,reason:p.no_next_reason})),
    mandatory_open: histories.filter(h=>eventMap.get(h.event_id)?.mandatory&&h.status!=='completed').map(h=>({employee_id:h.employee_id,event_id:h.event_id,title:eventMap.get(h.event_id)!.title,due_date:h.due_date,status:h.status})),
    participation: dataset.events.map(e=>{const rows=histories.filter(h=>h.event_id===e.event_id);const by_status:Record<string,number>={};for(const h of rows)by_status[h.status]=(by_status[h.status]??0)+1;return{event_id:e.event_id,title:e.title,total:rows.length,completed:by_status.completed??0,by_status};}),
    as_of: asOf, scope: { profiles: profiles.length, history_records: histories.length }, skill_gaps,
    critical_gaps: { employees: profiles.filter(p => p.gaps.some(g => g.critical && g.gap > 0)).length },
    completions: { total: histories.length, completed, rate_pct: pct(completed, histories.length), by_status },
    no_show: { eligible: occurredScheduled.length, no_show: noShows, rate_pct: pct(noShows, occurredScheduled.length) },
    mandatory_overdue: { count: overdue },
    no_next_step: { total: Object.values(noNext).reduce((a, b) => a + b, 0), by_reason: noNext },
    no_voluntary_completion_90d: { count: noVoluntary }, catalog_gaps, event_groups,
    on_time: { eligible: timely.length, on_time: onTime, rate_pct: pct(onTime, timely.length) },
    caveat_codes: ['self_paced_enrollment_date', 'historical_completion_proxy', 'direct_catalog_coverage_only'],
    caveats: [
      'Source self_paced date is enrollment, not confirmed completion time.',
      'Historical completion time without exact completed_at uses date as a proxy.',
      'Catalog gaps reflect currently eligible direct coverage, not proof that no prerequisite path exists.',
    ],
  };
}
