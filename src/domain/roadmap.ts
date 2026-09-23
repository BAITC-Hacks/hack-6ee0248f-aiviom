import type { Dataset, Event, Gap, Levels, Milestone, Profile, Roadmap } from '../shared/types.js';
import { applyGains, audienceAllows, eventRepeatBlocked, gapsFor, nextSession, prerequisitesMet } from './calculation.js';

interface State { skills: Levels; path: { event: Event; session: string | null }[]; after: string; hours: number; gap: number; critical: number }

export function buildRoadmap(dataset: Dataset, profile: Profile, weeklyBudget?: number): Roadmap {
  const target = profile.goal ? dataset.role_profiles.find(p => p.role === profile.goal?.target_role && p.grade === profile.goal?.target_grade) ?? null : null;
  const catalog = dataset.events.filter(e => !e.mandatory && audienceAllows(e, profile.employee));
  const initial = gapsFor(dataset, profile.skills, target);
  const milestoneEvents = (skillId: string) => catalog.filter(e => e.develops_skills.some(g => g.skill_id === skillId && g.gain > 0)).map(e => e.event_id);
  const milestones: Milestone[] = initial.gaps.map(g => ({
    skill_id: g.skill_id, name: g.name, current: g.current, required: g.required, critical: g.critical,
    status: g.gap === 0 ? 'met' : catalog.some(e => e.develops_skills.some(x => x.skill_id === g.skill_id && x.gain > 0) &&
      prerequisitesMet(e, profile.skills) && (e.format === 'self_paced' || nextSession(e, profile.as_of, profile.history))) ? 'available' : 'blocked',
    event_ids: milestoneEvents(g.skill_id),
  }));
  if (!target || initial.total_gap === 0) return { milestones, steps: [], remaining_gaps: initial.gaps.filter(g => g.gap > 0), search_limited: false, plan_hours: 0, weeks_lower_bound: weeklyBudget && weeklyBudget > 0 ? 0 : null };

  const metric = (skills: Levels) => gapsFor(dataset, skills, target);
  const score = (s: State) => s.gap * 100 + s.critical * 30 + s.hours * 0.05 + s.path.length * 0.01;
  const initialState: State = { skills: { ...profile.skills }, path: [], after: profile.as_of, hours: 0,
    gap: initial.total_gap, critical: initial.gaps.filter(g => g.critical).reduce((n, g) => n + g.gap, 0) };
  let beam = [initialState];
  let best = initialState;
  let search_limited = false;
  const visited = new Set<string>();
  const MAX_DEPTH = 8;
  const BEAM_WIDTH = 24;
  const MAX_STATES = 512;
  let explored = 0;
  for (let depth = 0; depth < MAX_DEPTH && beam.length; depth++) {
    const next: State[] = [];
    for (const state of beam) {
      for (const event of catalog) {
        if (event.event_id !== 'EV_036' && state.path.some(x => x.event.event_id === event.event_id)) continue;
        if (!prerequisitesMet(event, state.skills)) continue;
        const plannedSessions = state.path.filter(x => x.event.event_id === event.event_id && x.session)
          .map((x, i) => ({ record_id: `planned-${i}`, employee_id: profile.employee.employee_id, event_id: event.event_id,
            date: x.session!, due_date: null, status: 'completed', completion_pct: 100, score: null, feedback_rating: null, assigned_by: 'self' }));
        const eventHistory = [...profile.history, ...plannedSessions];
        const session = event.format === 'self_paced' ? null : nextSession(event, state.after, eventHistory);
        if (event.format !== 'self_paced' && session === null) continue;
        if (eventRepeatBlocked(event, eventHistory, session)) continue;
        const after = applyGains(state.skills, event.develops_skills).after;
        if (JSON.stringify(after) === JSON.stringify(state.skills)) continue;
        const m = metric(after);
        const critical = m.gaps.filter(g => g.critical).reduce((n, g) => n + g.gap, 0);
        const child: State = { skills: after, path: [...state.path, { event, session }], after: session ?? state.after,
          hours: state.hours + event.duration_hours, gap: m.total_gap, critical };
        const key = `${Object.entries(after).sort(([a], [b]) => a.localeCompare(b)).map(([id, v]) => `${id}:${v}`).join('|')}@${child.after}`;
        if (visited.has(key)) continue;
        visited.add(key);
        next.push(child);
        explored++;
        if (score(child) < score(best) || score(child) === score(best) && child.path.map(x => x.event.event_id).join() < best.path.map(x => x.event.event_id).join()) best = child;
        if (explored >= MAX_STATES) { search_limited = true; break; }
      }
      if (search_limited) break;
    }
    if (search_limited) break;
    next.sort((a, b) => score(a) - score(b) || a.path.map(x => x.event.event_id).join().localeCompare(b.path.map(x => x.event.event_id).join()));
    if (next.length > BEAM_WIDTH) search_limited = true;
    beam = next.slice(0, BEAM_WIDTH);
    if (best.gap === 0) break;
  }
  if (beam.length && best.gap > 0 && best.path.length >= MAX_DEPTH) search_limited = true;
  const selected = best.path.map(({ event, session }) => ({ event_id: event.event_id, session,
    status: profile.history.some(h => h.event_id === event.event_id && h.status === 'in_progress') ? 'in_progress' : 'planned',
    reason: 'contributes_to_goal_or_unlocks_step' }));
  const selectedIds = new Set(selected.map(s => s.event_id));
  const blocked = profile.candidates.filter(c => !selectedIds.has(c.event.event_id) && !c.eligible && c.U > 0)
    .slice(0, 5).map(c => ({ event_id: c.event.event_id, session: c.session, status: 'blocked', reason: c.reasons.join(', ') }));
  const remaining_gaps: Gap[] = metric(best.skills).gaps.filter(g => g.gap > 0);
  return { milestones, steps: [...selected, ...blocked], remaining_gaps, search_limited,
    plan_hours: best.hours, weeks_lower_bound: weeklyBudget && weeklyBudget > 0 ? Math.ceil(best.hours / weeklyBudget) : null };
}
