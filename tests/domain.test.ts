import test from 'node:test';
import assert from 'node:assert/strict';
import type { Dataset, Employee, Event, History } from '../src/shared/types.js';
import { buildAnalytics, buildProfile, buildRoadmap, loadSourceDataset, previewEvent, validateImport } from '../src/domain/index.js';
import { applyGains } from '../src/domain/calculation.js';

const employee: Employee = {
  employee_id: 'E1', full_name: 'Example Person', department: 'Engineering', role: 'Engineer', grade: 'Junior',
  manager_id: null, hire_date: '2026-01-01', tenure_months: 9, work_format: 'remote', preferred_language: 'ru',
  career_goal: { target_role: 'Engineer', target_grade: 'Middle' }, skills: { A: 1, B: 0 }, last_review_date: '2026-09-01',
};
const event = (id: string, gains: Event['develops_skills'], prerequisites: Event['prerequisites'] = {}, sessions: string[] = []): Event => ({
  event_id: id, title: id, description: '', type: 'course', format: sessions.length ? 'online' : 'self_paced', duration_hours: 2,
  mandatory: false, target_roles: ['Engineer'], target_grades: ['Junior'], develops_skills: gains, prerequisites, upcoming_sessions: sessions,
});
const history = (id: string, eventId: string, date: string, status: string, completedAt?: string): History => ({
  record_id: id, employee_id: 'E1', event_id: eventId, date, due_date: null, status, completion_pct: status === 'completed' ? 100 : 50,
  score: null, feedback_rating: null, assigned_by: 'self', ...(completedAt ? { completed_at: completedAt, completion_time_quality: 'exact' as const } : {}),
});
const fixture = (): Dataset => ({
  employees: [structuredClone(employee)],
  skills: [{ skill_id: 'A', name: 'A skill', type: 'hard', category: 'test', description: '' }, { skill_id: 'B', name: 'B skill', type: 'hard', category: 'test', description: '' }],
  role_profiles: [{ role: 'Engineer', grade: 'Junior', required_skills: { A: 1 }, critical_skills: [] },
    { role: 'Engineer', grade: 'Middle', required_skills: { A: 2, B: 1 }, critical_skills: ['B'] }],
  events: [event('PREP', [{ skill_id: 'A', gain: 1, max_level: 5 }]), event('GOAL', [{ skill_id: 'B', gain: 1, max_level: 5 }], { A: 2 })],
  history: [],
});

test('source wrappers and CSV normalize to documented counts without mutation', () => {
  const d = loadSourceDataset();
  assert.deepEqual([d.employees.length, d.events.length, d.skills.length, d.role_profiles.length, d.history.length], [200, 40, 60, 32, 2743]);
  assert.equal(d.history[0].due_date, null);
  assert.equal(d.history[0].completion_pct, 100);
  assert.ok(d.employees[0].skills);
});

test('gain cap never lowers skill and sums repeated gains within cap', () => {
  assert.deepEqual(applyGains({ A: 4 }, [{ skill_id: 'A', gain: 2, max_level: 3 }]).after, { A: 4 });
  assert.deepEqual(applyGains({ A: 3 }, [{ skill_id: 'A', gain: 2, max_level: 5 }, { skill_id: 'A', gain: 2, max_level: 5 }]).after, { A: 5 });
  assert.throws(() => applyGains({ A: 6 }, [{ skill_id: 'A', gain: 1, max_level: 5 }]));
});

test('only completed after review contributes, sorted by effective completion date', () => {
  const d = fixture();
  d.events.push(event('LOW_CAP', [{ skill_id: 'A', gain: 2, max_level: 2 }]));
  d.history.push(history('R3', 'PREP', '2026-09-06', 'in_progress'));
  d.history.push(history('R2', 'PREP', '2026-08-29', 'completed'));
  d.history.push(history('R1', 'LOW_CAP', '2026-08-30', 'completed', '2026-09-02'));
  d.history.push(history('R4', 'PREP', '2026-09-03', 'completed'));
  const p = buildProfile(d, 'E1', { asOf: '2026-10-01' });
  assert.equal(p.skills.A, 3);
  assert.deepEqual(p.provenance.map(x => [x.record_id, x.quality]), [['R1', 'exact'], ['R4', 'proxy']]);
  assert.equal(d.employees[0].skills.A, 1);
});

test('trusted same-day application is counted once while reviewed history remains baseline', () => {
  const d = fixture();
  d.history.push(history('REVIEWED', 'PREP', '2026-09-01', 'completed'));
  d.history.push({ ...history('CONFIRMED', 'GOAL', '2026-09-01', 'completed'), application_credit: true });
  const credits = [{ credit_id: 'C1', employee_id: 'E1', completed_at: '2026-09-01',
    gains: [{ skill_id: 'B', gain: 1, max_level: 5 }], source_id: 'CONFIRMED', application_credit: true }];
  const p = buildProfile(d, 'E1', { asOf: '2026-09-01', credits });
  assert.deepEqual(p.skills, { A: 1, B: 1 });
  assert.deepEqual(p.provenance.map(x => x.record_id), ['CONFIRMED']);
  assert.equal(buildProfile(d, 'E1', { asOf: '2026-09-01', credits }).skills.B, 1);
});

test('future exact completion does not affect as-of skills, repeat rule or analytics', () => {
  const d = fixture();
  d.history.push(history('R1', 'PREP', '2026-09-20', 'completed', '2026-10-04'));
  const before = buildProfile(d, 'E1', { asOf: '2026-10-01' });
  assert.equal(before.skills.A, 1);
  assert.equal(before.candidates.find(c => c.event.event_id === 'PREP')?.eligible, true);
  assert.equal(buildAnalytics(d, [before], before.as_of).completions.total, 0);
  const after = buildProfile(d, 'E1', { asOf: '2026-10-05' });
  assert.equal(after.skills.A, 2);
  assert.equal(after.candidates.find(c => c.event.event_id === 'PREP')?.eligible, false);
});

test('unknown explicit target is rejected rather than treated as a missing goal', () => {
  assert.throws(() => buildProfile(fixture(), 'E1', { goal: { target_role: 'Unknown', target_grade: 'Senior' } }), /Unknown goal profile/);
});

test('unrelated in-progress activity does not conceal a missing useful next step', () => {
  const d = fixture();
  d.events = [event('OTHER', [])];
  d.history.push(history('R1', 'OTHER', '2026-09-30', 'in_progress'));
  const p = buildProfile(d, 'E1');
  assert.equal(p.candidates[0].continuing, true);
  assert.equal(p.no_next_reason, 'catalog_gap');
});

test('preview is pure, unlocks prerequisite, and roadmap sequences preparation first', () => {
  const d = fixture();
  const p = buildProfile(d, 'E1');
  assert.equal(p.coverage, 100 / 3);
  assert.equal(p.candidates.find(c => c.event.event_id === 'GOAL')?.eligible, false);
  const preview = previewEvent(d, p, 'PREP');
  assert.deepEqual(preview.unlocked_event_ids, ['GOAL']);
  assert.equal(p.skills.A, 1);
  const road = buildRoadmap(d, p, 2);
  assert.deepEqual(road.steps.filter(s => s.status === 'planned').map(s => s.event_id), ['PREP', 'GOAL']);
  assert.equal(road.plan_hours, 4);
  assert.equal(road.weeks_lower_bound, 2);
  assert.equal(road.remaining_gaps.length, 0);
  assert.equal(road.steps[0].title, 'PREP');
  assert.equal(road.steps[0].hours, 2);
  assert.deepEqual(road.steps[0].unlocks_event_ids, ['GOAL']);
  assert.deepEqual(road.steps[0].skill_changes?.map(change => [change.skill_id, change.before, change.after, change.gap_before, change.gap_after]),
    [['A', 1, 2, 1, 0]]);
});

test('EV_036 offers a different session, never repeats a completed session', () => {
  const d = fixture();
  d.events.push(event('EV_036', [{ skill_id: 'B', gain: 1, max_level: 5 }], {}, ['2026-10-02', '2026-10-10']));
  d.history.push(history('R1', 'EV_036', '2026-10-02', 'completed'));
  const p = buildProfile(d, 'E1', { asOf: '2026-10-03' });
  const club = p.candidates.find(c => c.event.event_id === 'EV_036');
  assert.equal(club?.session, '2026-10-10');
  assert.equal(club?.eligible, true);
});

test('roadmap may use EV_036 twice only on distinct available sessions', () => {
  const d = fixture();
  d.role_profiles[1].required_skills = { A: 1, B: 2 };
  d.events = [event('EV_036', [{ skill_id: 'B', gain: 1, max_level: 5 }], {}, ['2026-10-02', '2026-10-10'])];
  const p = buildProfile(d, 'E1');
  const road = buildRoadmap(d, p, 2);
  assert.deepEqual(road.steps.map(s => s.session), ['2026-10-02', '2026-10-10']);
  assert.equal(road.remaining_gaps.length, 0);
});

test('import accepts unknown profile with source wrapper and reports unresolved manager', () => {
  const d = fixture();
  const incoming = { ...structuredClone(employee), employee_id: 'E2', manager_id: 'UNRESOLVED' };
  const r = validateImport(d, { employees: { meta: {}, employees: [incoming] }, history: 'record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by\nR1,E2,PREP,2026-09-22,,completed,100,,,self\n' });
  assert.equal(r.valid, true);
  assert.deepEqual(r.counts, { employees: 1, history: 1 });
  assert.equal(r.history[0].score, null);
  assert.match(r.warnings.join(' '), /unresolved/);
  const augmented: Dataset = { ...d, employees: [...d.employees, ...r.employees], history: [...d.history, ...r.history] };
  assert.equal(buildProfile(augmented, 'E2').skills.A, 2);
  assert.equal(validateImport(augmented, { employees: [incoming], history: r.history }).counts.history, 0);
});

test('import rejects bad skill, event and conflicting existing ID', () => {
  const d = fixture();
  const bad = { ...structuredClone(employee), employee_id: 'E2', skills: { UNKNOWN: 3 } };
  const r = validateImport(d, { employees: [bad], history: [{ ...history('R1', 'UNKNOWN', '2026-09-22', 'completed'), employee_id: 'MISSING' }] });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some(e => e.field === 'skills.UNKNOWN'));
  assert.ok(r.errors.some(e => e.field === 'event_id'));
  assert.ok(r.errors.some(e => e.field === 'employee_id'));
  const conflict = validateImport(d, { employees: [{ ...employee, full_name: 'Different' }] });
  assert.ok(conflict.errors.some(e => e.field === 'employee_id'));
  const invalidStatusPct = validateImport(d, { history: [{ ...history('R2', 'PREP', '2026-09-22', 'no_show'), completion_pct: 50 }] });
  assert.ok(invalidStatusPct.errors.some(e => e.field === 'completion_pct'));
  const duplicateCompletion = validateImport(d, { history: [history('R2', 'PREP', '2026-09-22', 'completed'), history('R3', 'PREP', '2026-09-23', 'completed')] });
  assert.ok(duplicateCompletion.errors.some(e => e.field === 'event_id'));
});

test('import cannot claim trusted same-day application credit', () => {
  const d = fixture();
  const imported = validateImport(d, { history: [{ ...history('SPOOF', 'PREP', '2026-09-01', 'completed'), application_credit: true }] });
  assert.equal(imported.valid, true);
  assert.equal(imported.history[0].application_credit, undefined);
  assert.equal(buildProfile({ ...d, history: imported.history }, 'E1', { asOf: '2026-09-01' }).skills.A, 1);
});

test('analytics denominators and exact on-time exclude proxy completions', () => {
  const d = fixture();
  d.history.push(history('R1', 'PREP', '2026-09-20', 'completed'));
  const p = buildProfile(d, 'E1');
  const a = buildAnalytics(d, [p], p.as_of);
  assert.equal(a.completions.rate_pct, 100);
  assert.equal(a.no_show.rate_pct, null);
  assert.equal(a.on_time.rate_pct, null);
  assert.equal(a.skill_gaps.find(g => g.skill_id === 'B')?.frequency_pct, 100);
  assert.equal(a.no_voluntary_completion_90d.count, 0);
});

test('catalog coverage is per employee-skill pair and separates participation', () => {
  const d = fixture();
  d.employees[0].skills = { A: 2, B: 0 };
  d.employees.push({ ...structuredClone(d.employees[0]), employee_id: 'E2', full_name: 'Blocked Employee', skills: { A: 0, B: 0 } });
  d.events.push({ ...event('MANDATORY', []), mandatory: true });
  d.history.push(history('V1', 'PREP', '2026-09-20', 'declined'));
  d.history.push({ ...history('M1', 'MANDATORY', '2026-09-20', 'in_progress'), due_date: '2026-09-25', assigned_by: 'hr' });
  const analytics = buildAnalytics(d, d.employees.map(e => buildProfile(d, e.employee_id)), '2026-10-01');
  const b = analytics.catalog_gaps.find(g => g.skill_id === 'B');
  assert.deepEqual([b?.with_gap, b?.with_next_step, b?.without_next_step], [2, 1, 1]);
  assert.deepEqual(b?.by_reason, { prerequisites_blocked: 1 });
  assert.deepEqual(b?.affected_employees.map(e => e.employee_id), ['E2']);
  assert.equal(analytics.participation_breakdown.voluntary.declined, 1);
  assert.equal(analytics.participation_breakdown.mandatory.overdue, 1);
  assert.equal(analytics.participation_breakdown.mandatory.total, 1);
});

test('conflict profile prioritizes critical target skill over numerically weakest rejected skill', () => {
  const d = fixture();
  d.employees[0].skills = { A: 1, B: 2 };
  d.role_profiles[1].required_skills = { A: 3, B: 4 };
  d.role_profiles[1].critical_skills = ['B'];
  const publicEvent = { ...event('PUBLIC', [{ skill_id: 'A', gain: 1, max_level: 5 }]), type: 'workshop' };
  const designEvent = { ...event('DESIGN', [{ skill_id: 'B', gain: 1, max_level: 5 }]), type: 'course' };
  d.events = [publicEvent, designEvent, ...['SKIP1', 'SKIP2', 'SKIP3'].map(id => ({ ...event(id, []), type: 'workshop' }))];
  d.history = ['SKIP1', 'SKIP2', 'SKIP3'].map((id, index) => history(`H${index}`, id, '2026-09-20', 'declined'));
  const profile = buildProfile(d, 'E1');
  assert.equal(profile.gaps.find(g => g.skill_id === 'A')?.current, 1);
  assert.equal(profile.gaps.find(g => g.skill_id === 'B')?.current, 2);
  assert.equal(profile.candidates.filter(c => c.eligible && c.U > 0)[0].event.event_id, 'DESIGN');
  assert.ok(profile.candidates.find(c => c.event.event_id === 'DESIGN')!.K > 0);
  assert.ok(profile.candidates.find(c => c.event.event_id === 'PUBLIC')!.H < profile.candidates.find(c => c.event.event_id === 'DESIGN')!.H);
});

test('completed, prerequisite and cap constraints reject superficially helpful events', () => {
  const d = fixture();
  d.events = [
    event('DONE', [{ skill_id: 'B', gain: 1, max_level: 5 }]),
    event('LOCKED', [{ skill_id: 'B', gain: 1, max_level: 5 }], { A: 3 }),
    event('CAPPED', [{ skill_id: 'A', gain: 1, max_level: 1 }]),
    event('VALID', [{ skill_id: 'A', gain: 1, max_level: 5 }]),
  ];
  d.history.push(history('OLD', 'DONE', '2026-09-01', 'completed'));
  const candidates = buildProfile(d, 'E1').candidates;
  assert.ok(candidates.find(c => c.event.event_id === 'DONE')!.reasons.includes('already_completed'));
  assert.ok(candidates.find(c => c.event.event_id === 'LOCKED')!.reasons.includes('prerequisites_blocked'));
  assert.equal(candidates.find(c => c.event.event_id === 'CAPPED')!.U, 0);
  assert.equal(candidates.filter(c => c.eligible && c.U > 0).map(c => c.event.event_id).join(','), 'VALID');
});

test('roadmap does not schedule dependent session before preparation effort can finish', () => {
  const d=fixture();
  d.events[0].duration_hours=8;
  d.events[1].format='online';d.events[1].upcoming_sessions=['2026-10-02','2026-10-20'];
  const road=buildRoadmap(d,buildProfile(d,'E1'),4);
  assert.equal(road.steps.find(s=>s.event_id==='GOAL'&&s.status==='planned')?.session,'2026-10-20');
  assert.deepEqual(road.steps.find(s=>s.event_id==='PREP'&&s.status==='planned')?.unlocks_event_ids,['GOAL']);
});

test('roadmap does not claim an expired scheduled activity was unlocked', () => {
  const d=fixture();
  d.events[0].duration_hours=8;
  d.events[1].format='online';d.events[1].upcoming_sessions=['2026-10-02'];
  const road=buildRoadmap(d,buildProfile(d,'E1'),4);
  assert.deepEqual(road.steps.find(s=>s.event_id==='PREP'&&s.status==='planned')?.unlocks_event_ids,[]);
});

test('milestone availability excludes completed courses and cap below current skill',()=>{
 const d=fixture();d.events=[event('OLD',[{skill_id:'A',gain:1,max_level:1}])];
 const road=buildRoadmap(d,buildProfile(d,'E1'),4);
 assert.equal(road.milestones.find(m=>m.skill_id==='A')?.status,'blocked');
 assert.deepEqual(road.milestones.find(m=>m.skill_id==='A')?.event_ids,[]);
});

test('approved quest is a visible alternative but does not grant milestone credit', () => {
  const d = fixture();
  const p = buildProfile(d,'E1');
  const before = JSON.stringify(p);
  const roadmap = buildRoadmap(d,p,4,[{id:'Q1',employee_id:'E1',title:'Practice',status:'ready',advisor_approved:true,gains:[{skill_id:'B',gain:1,max_level:5}]} as any]);
  assert.deepEqual(roadmap.alternatives?.[0].skill_ids,['B']);
  assert.equal(roadmap.milestones.find(m=>m.skill_id==='B')?.current,0);
  assert.equal(JSON.stringify(p),before);
});
