import type { Dataset, Event, Gap, Levels, Milestone, Profile, Roadmap, Quest } from '../shared/types.js';
import { applyGains, audienceAllows, eventRepeatBlocked, gapsFor, nextSession, prerequisitesMet } from './calculation.js';

interface State { skills: Levels; path: { event: Event; session: string | null; finished_at: string }[]; after: string; hours: number; gap: number; critical: number }

export function buildRoadmap(dataset: Dataset, profile: Profile, weeklyBudget?: number, quests: Quest[] = []): Roadmap {
  const target = profile.goal ? dataset.role_profiles.find(p => p.role === profile.goal?.target_role && p.grade === profile.goal?.target_grade) ?? null : null;
  const catalog = dataset.events.filter(e => !e.mandatory && audienceAllows(e, profile.employee));
  const initial = gapsFor(dataset, profile.skills, target);
  const alternatives = quests.filter(q => q.employee_id === profile.employee.employee_id && q.advisor_approved && !['accepted','rejected'].includes(q.status)).map(q => {
    const deltas = applyGains(profile.skills, q.gains).deltas;
    return {quest_id:q.id, title:q.title, status:q.status, skill_ids:initial.gaps.filter(g=>g.gap>0&&(deltas[g.skill_id]??0)>0).map(g=>g.skill_id)};
  }).filter(q=>q.skill_ids.length>0);
  const milestoneEvents = (skillId: string) => profile.candidates.filter(c => !c.reasons.includes('already_completed') && !c.reasons.includes('audience_blocked') && (c.deltas[skillId] ?? 0) > 0).map(c => c.event.event_id);
  const milestones: Milestone[] = initial.gaps.map(g => ({
    skill_id: g.skill_id, name: g.name, current: g.current, required: g.required, critical: g.critical,
    status: g.gap === 0 ? 'met' : profile.candidates.some(c => c.eligible && (c.deltas[g.skill_id] ?? 0) > 0) ? 'available' : 'blocked',
    event_ids: milestoneEvents(g.skill_id),
  }));
  if (!target || initial.total_gap === 0) return { alternatives, milestones, steps: [], remaining_gaps: initial.gaps.filter(g => g.gap > 0), search_limited: false, plan_hours: 0, weeks_lower_bound: weeklyBudget && weeklyBudget > 0 ? 0 : null };

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
  let exhausted = false;
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
        const startDate = session ?? state.after;
        const effortDays = weeklyBudget && weeklyBudget > 0 ? Math.ceil(event.duration_hours * 7 / weeklyBudget) : 0;
        const finish = new Date(startDate + 'T00:00:00Z');
        finish.setUTCDate(finish.getUTCDate() + effortDays);
        const finished_at = finish.toISOString().slice(0, 10);
        const child: State = { skills: after, path: [...state.path, { event, session, finished_at }], after: finished_at,
          hours: state.hours + event.duration_hours, gap: m.total_gap, critical };
        const key = `${Object.entries(after).sort(([a], [b]) => a.localeCompare(b)).map(([id, v]) => `${id}:${v}`).join('|')}@${child.after}`;
        if (visited.has(key)) continue;
        visited.add(key);
        next.push(child);
        explored++;
        if (score(child) < score(best) || score(child) === score(best) && child.path.map(x => x.event.event_id).join() < best.path.map(x => x.event.event_id).join()) best = child;
        if (explored >= MAX_STATES) { search_limited = true; exhausted = true; break; }
      }
      if (exhausted) break;
    }
    if (exhausted) break;
    next.sort((a, b) => score(a) - score(b) || a.path.map(x => x.event.event_id).join().localeCompare(b.path.map(x => x.event.event_id).join()));
    if (next.length > BEAM_WIDTH) search_limited = true;
    beam = next.slice(0, BEAM_WIDTH);
    if (best.gap === 0) break;
  }
  if (beam.length && best.gap > 0 && best.path.length >= MAX_DEPTH) search_limited = true;
  let projectedSkills = { ...profile.skills };
  const selected = best.path.map(({ event, session, finished_at }, index) => {
    const before = projectedSkills;
    const after = applyGains(before, event.develops_skills).after;
    const skill_changes = event.develops_skills.flatMap(gain => {
      const start = before[gain.skill_id] ?? 0;
      const end = after[gain.skill_id] ?? 0;
      if (end <= start) return [];
      const gap = initial.gaps.find(g => g.skill_id === gain.skill_id);
      return [{ skill_id: gain.skill_id, name: dataset.skills.find(s => s.skill_id === gain.skill_id)?.name ?? gain.skill_id,
        before: start, after: end, required: gap?.required ?? null,
        gap_before: gap ? Math.max(0, gap.required - start) : null,
        gap_after: gap ? Math.max(0, gap.required - end) : null }];
    });
    const priorIds = new Set(best.path.slice(0, index + 1).map(x => x.event.event_id));
    const unlocks_event_ids = catalog.filter(other => {
      if (priorIds.has(other.event_id) || prerequisitesMet(other, before) || !prerequisitesMet(other, after)) return false;
      const availableSession = nextSession(other, finished_at, profile.history);
      return (other.format === 'self_paced' || availableSession !== null) &&
        !eventRepeatBlocked(other, profile.history, availableSession);
    }).map(other => other.event_id);
    projectedSkills = after;
    return { event_id: event.event_id, title: event.title, hours: event.duration_hours, session,
      status: profile.history.some(h => h.event_id === event.event_id && h.status === 'in_progress') ? 'in_progress' : 'planned',
      reason: 'contributes_to_goal_or_unlocks_step', skill_changes, unlocks_event_ids };
  });
  const selectedIds = new Set(selected.map(s => s.event_id));
  const blocked = profile.candidates.filter(c => !selectedIds.has(c.event.event_id) && !c.eligible && c.U > 0)
    .slice(0, 5).map(c => ({ event_id: c.event.event_id, title: c.event.title, hours: c.event.duration_hours,
      session: c.session, status: 'blocked', reason: c.reasons.join(', '), skill_changes: [], unlocks_event_ids: [] }));
  const remaining_gaps: Gap[] = metric(best.skills).gaps.filter(g => g.gap > 0);
  return { alternatives, milestones, steps: [...selected, ...blocked], remaining_gaps, search_limited,
    plan_hours: best.hours, weeks_lower_bound: weeklyBudget && weeklyBudget > 0 ? Math.ceil(best.hours / weeklyBudget) : null };
}
