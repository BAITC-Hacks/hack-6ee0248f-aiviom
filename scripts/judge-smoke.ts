import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadSourceDataset, buildProfile, validateImport } from '../src/domain/index.js';
import { judgeRecommendation } from '../src/server/gateway.js';

const dataset = loadSourceDataset();
const existing = dataset.employees.map(e => buildProfile(dataset, e.employee_id)).find(p => p.goal && p.candidates.filter(c => c.eligible && !c.event.mandatory && (c.U > 0 || c.B > 0)).length >= 2);
assert.ok(existing, 'No source profile with a goal and two useful activities');
const suffix = randomUUID().slice(0, 12);
const employee = { ...existing.employee, employee_id: `JUDGE_SMOKE_${suffix}`, full_name: 'Internal smoke profile', manager_id: null };
const related = existing.candidates.find(c => c.eligible && !c.event.mandatory && (c.U > 0 || c.B > 0));
assert.ok(related);
const history = `record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by\nJUDGE_HISTORY_${suffix},${employee.employee_id},${related.event.event_id},2026-09-20,,declined,0,,,self\n`;
const validated = validateImport(dataset, { employees: [employee], history });
assert.equal(validated.valid, true, `New profile/history validation failed: ${JSON.stringify(validated.errors)}`);
assert.equal(validated.counts.employees, 1);
assert.equal(validated.counts.history, 1);
dataset.employees.push(...validated.employees);
dataset.history.push(...validated.history);
const profile = buildProfile(dataset, employee.employee_id);
const allowed = new Map(profile.candidates.filter(c => c.eligible && !c.event.mandatory && (c.U > 0 || c.B > 0)).map(c => [c.event.event_id, c]));
assert.ok(allowed.size >= 2, 'Imported profile lost real alternatives');
const locales = process.argv.includes('--all-locales') ? ['ru', 'kk', 'en'] as const : ['ru'] as const;
for (const locale of locales) {
  const started = performance.now();
  const result = await judgeRecommendation(profile, `judge-smoke-${suffix}`, locale);
  const elapsed = performance.now() - started;
  const evidence = { locale, returned_locale: result.locale, mode: result.mode, model: result.model, cold_latency_ms: Math.round(elapsed), count: result.recommendations.length, event_ids: result.recommendations.map(r => r.event_id), warning_codes: result.warning_codes ?? [], usage: result.usage ?? null };
  console.log(JSON.stringify(evidence));
  assert.equal(result.locale, locale, 'Locale mismatch');
  assert.equal(result.mode, 'live_ai', 'Fresh profile must make a cold live AI call');
  assert.ok(elapsed < 10_000, `Cold AI exceeded 10 seconds: ${elapsed.toFixed(0)}ms`);
  assert.ok(result.recommendations.length >= 1 && result.recommendations.length <= 3, 'Expected 1–3 recommendations');
  const ids = result.recommendations.map(r => r.event_id);
  assert.equal(new Set(ids).size, ids.length, 'Recommendation IDs must be unique');
  for (const rec of result.recommendations) {
    assert.ok(allowed.has(rec.event_id), `Ineligible or mandatory activity: ${rec.event_id}`);
    assert.deepEqual(new Set(rec.factor_keys), new Set(['grade', 'skill_gap', 'history', 'target_requirements']));
    assert.ok(rec.facts && rec.facts.length >= 4, 'Expected four server-verified evidence factors');
    assert.deepEqual(new Set(rec.facts.map(f => f.factor)), new Set(['grade', 'skill_gap', 'history', 'target_requirements']));
    assert.ok(rec.facts.every(f => Boolean(f.id && f.label && f.value)), 'Incomplete factual evidence');
    assert.ok(rec.evidence_ids.includes(`event:${rec.event_id}`));
    assert.ok(rec.evidence_ids.includes(`history:relevant:${rec.event_id}`), 'Missing candidate-specific history');
    assert.ok(rec.alternative_event_id && rec.alternative_event_id !== rec.event_id && allowed.has(rec.alternative_event_id), 'Missing real eligible alternative');
    assert.ok(rec.summary && rec.reason.includes(rec.summary), 'Missing verified explanation');
  }
}
