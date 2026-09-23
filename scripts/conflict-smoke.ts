import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadSourceDataset } from '../src/domain/index.js';

// Internal synthetic regression A, built from real source-catalog activities.
// This is not a secret judge profile and does not read credentials.
const arg = process.argv.indexOf('--base');
const base = arg >= 0 ? process.argv[arg + 1] : 'http://127.0.0.1:3000';
const source = loadSourceDataset();
const original = source.employees.find(e => e.employee_id === 'E0155');
assert.ok(original);
const id = `REG_A_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
const employee = { ...original, employee_id: id, full_name: 'Internal conflict regression A', manager_id: null,
  last_review_date: '2026-10-01', career_goal: { target_role: 'Backend Engineer', target_grade: 'Senior' },
  skills: { ...original.skills, SK_PUBLIC_SPEAKING: 0, SK_SYSTEM_DESIGN: 3 } };
const history = ['record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by',
  ...['declined', 'no_show', 'dropped'].map((status, i) => `${id}_H${i},${id},EV_036,2026-09-0${i + 1},,${status},${status === 'dropped' ? 10 : 0},,,self`)].join('\n');
let cookie = '';
async function call(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(new URL(path, base), { method, headers: { cookie, 'Content-Type': 'application/json', 'Accept-Language': 'ru' }, body: body === undefined ? undefined : JSON.stringify(body) });
  cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
  const data = await response.json();
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(data)}`);
  return data;
}
await call('/api/session');
await call('/api/session/switch', 'POST', { identity_id: 'hr' });
const input = { employees: [employee], history };
assert.equal((await call('/api/import/preview', 'POST', input)).valid, true);
await call('/api/import/commit', 'POST', input);
await call('/api/session/switch', 'POST', { identity_id: `employee:${id}` });
const profile = await call(`/api/employees/${id}/profile`);
const speaking = profile.gaps.find((g: any) => g.skill_id === 'SK_PUBLIC_SPEAKING');
const system = profile.gaps.find((g: any) => g.skill_id === 'SK_SYSTEM_DESIGN');
assert.ok(speaking.current < system.current && speaking.gap > system.gap && system.critical);
const started = performance.now();
const result = await call(`/api/employees/${id}/recommendations`, 'POST', {});
const latency_ms = Math.round(performance.now() - started);
assert.equal(result.mode, 'live_ai', JSON.stringify(result.warning_codes));
assert.ok(latency_ms < 10_000);
assert.ok(['EV_006', 'EV_007'].includes(result.recommendations[0]?.event_id), 'Critical System Design must precede weaker Public Speaking with negative participation');
console.log(JSON.stringify({ profile_id: id, mode: result.mode, latency_ms, event_ids: result.recommendations.map((r: any) => r.event_id), conflict: 'PASS', critical_skill: system.skill_id, weaker_skill: speaking.skill_id, negative_history_records: 3 }));
