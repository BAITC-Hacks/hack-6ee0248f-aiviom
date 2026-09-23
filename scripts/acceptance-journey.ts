import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildProfile, loadSourceDataset } from '../src/domain/index.js';
import type { Locale } from '../src/shared/locale.js';

/** Internal regression profile C; synthetic, never represented as a secret judge profile. */
export function regressionProfileC() {
  const dataset = loadSourceDataset();
  const original = dataset.employees.find((e) => {
    const fresh = structuredClone(dataset); fresh.history = [];
    return buildProfile(fresh, e.employee_id).candidates.some((c) => c.eligible && c.U > 0 && c.event.format === 'self_paced');
  });
  assert.ok(original, 'Source contains an independently useful self-paced path');
  const employee = {...structuredClone(original), employee_id: `REG_C_${randomUUID().replaceAll('-', '').slice(0, 12)}`, full_name: 'Internal regression C', manager_id: null, last_review_date: '2026-10-01'};
  const historical = dataset.events.find((e) => e.mandatory && e.format === 'self_paced')!;
  const history = ['record_id,employee_id,event_id,date,due_date,status,completion_pct,score,feedback_rating,assigned_by,completed_at,completion_time_quality',
    `REG_H_${randomUUID().slice(0,8)},${employee.employee_id},${historical.event_id},2026-10-01,,completed,100,90,,hr,2026-10-01,exact`].join('\n');
  return {employee, history};
}

export async function acceptanceJourney(base: string, options: {live?: boolean; locales?: Locale[]; restart?: () => Promise<void>} = {}) {
  let cookie = '';
  async function call(path: string, method='GET', body?: unknown, locale: Locale='ru', status=200) {
    const response = await fetch(new URL(path, base), {method, headers:{...(cookie?{cookie}:{}), 'Accept-Language':locale, ...(body===undefined?{}:{'Content-Type':'application/json'})}, body:body===undefined?undefined:JSON.stringify(body)});
    cookie=response.headers.get('set-cookie')?.split(';')[0] || cookie;
    const data=await response.json(); assert.equal(response.status,status,`${path}: ${JSON.stringify(data)}`); return data;
  }
  const session=await call('/api/session');
  const {employee,history}=regressionProfileC(); const id=employee.employee_id;
  await call('/api/session/switch','POST',{identity_id:'hr'});
  const input={employees:{employees:[employee]},history};
  const preview=await call('/api/import/preview','POST',input); assert.equal(preview.valid,true);
  assert.deepEqual(preview.counts,{employees:1,history:1});
  await call('/api/import/commit','POST',input);
  const secondImport=await call('/api/import/commit','POST',input); assert.deepEqual(secondImport.counts,{employees:0,history:0});
  await call('/api/session/switch','POST',{identity_id:`employee:${id}`});
  const before=await call(`/api/employees/${id}/profile`);
  assert.deepEqual(before.skills,employee.skills,'Same-day historical completion stays in review baseline');
  assert.equal(before.history.length,1);
  const timings: {locale:Locale;mode:string;latency_ms:number;event_ids:string[]}[]=[];
  for (const locale of options.locales ?? ['ru']) {
    const started=performance.now();
    const result=await call(`/api/employees/${id}/recommendations`,'POST',{},locale);
    const latency=Math.round(performance.now()-started);
    assert.equal(result.locale,locale); assert.ok(result.recommendations.length>=1 && result.recommendations.length<=3);
    assert.equal(new Set(result.recommendations.map((r:any)=>r.event_id)).size,result.recommendations.length);
    const useful=before.candidates.filter((c:any)=>c.eligible && (c.U>0||c.B>0));
    for(const rec of result.recommendations) {
      const candidate=useful.find((c:any)=>c.event.event_id===rec.event_id); assert.ok(candidate,'Existing eligible useful event'); assert.equal(candidate.event.mandatory,false);
      for(const factor of ['grade','skill_gap','history','target_requirements']) assert.ok(rec.factor_keys.includes(factor),`Missing ${factor}`);
      assert.ok(rec.facts?.length>=4,'Server-verified facts are present');
      if(useful.length>1) assert.ok(rec.alternative_event_id!==rec.event_id && useful.some((c:any)=>c.event.event_id===rec.alternative_event_id),'Real eligible alternative');
    }
    if(options.live) {assert.equal(result.mode,'live_ai','Unique imported profile must hit cold live provider'); assert.ok(latency<10000,`Cold AI took ${latency}ms`);}
    else assert.ok(['rules_fallback','live_ai','cached_live_ai'].includes(result.mode));
    timings.push({locale,mode:result.mode,latency_ms:latency,event_ids:result.recommendations.map((r:any)=>r.event_id)});
  }
  const candidate=before.candidates.find((c:any)=>c.eligible && c.U>0 && c.event.format==='self_paced'); assert.ok(candidate);
  const eventId=candidate.event.event_id;
  await call('/api/plan','POST',{employee_id:id,event_id:eventId});
  const beforeEvidence=await call(`/api/employees/${id}/profile`);
  const effect=await call(`/api/employees/${id}/preview`,'POST',{event_id:eventId});
  assert.deepEqual((await call(`/api/employees/${id}/profile`)).skills,before.skills,'Preview is pure');
  await call('/api/completion-requests','POST',{employee_id:id,event_id:eventId,evidence:'Internal regression C: completed assessed exercise'});
  const pending=await call(`/api/employees/${id}/profile`); assert.ok(pending.completion_requests.some((r:any)=>r.event_id===eventId&&r.status==='pending'));
  await call('/api/session/switch','POST',{identity_id:'advisor'});
  const queue=await call('/api/completion-requests');
  const request=queue.requests.find((r:any)=>r.employee_id===id&&r.event_id===eventId); assert.ok(request);
  const accepted=await call(`/api/completion-requests/${request.id}/accept`,'POST',{reason:'Regression evidence reviewed'});
  assert.equal(accepted.duplicate,false); assert.ok(accepted.xp>0); assert.ok(accepted.result.skills.length>0);
  const after=await call(`/api/employees/${id}/profile`);
  assert.deepEqual(after.skills,effect.after,'Actual skill changes match domain effect');
  assert.ok(after.coverage>before.coverage); assert.ok(after.plan_progress>0);
  assert.equal(accepted.result.coverage_before,before.coverage); assert.equal(accepted.result.coverage_after,after.coverage);
  assert.equal(after.completion_results.length,1);
  const roadmap=await call(`/api/employees/${id}/roadmap`);
  assert.ok(!roadmap.steps.some((s:any)=>s.event_id===eventId&&s.status!=='blocked'),'Completed course removed from next path');
  const duplicate=await call(`/api/completion-requests/${request.id}/accept`,'POST',{reason:'Duplicate regression check'});
  assert.equal(duplicate.duplicate,true); assert.equal(duplicate.xp,0);
  const repeated=await call(`/api/employees/${id}/profile`); assert.equal(repeated.xp,after.xp); assert.deepEqual(repeated.skills,after.skills); assert.equal(repeated.completion_results.length,1);
  await call('/api/session/switch','POST',{identity_id:`employee:${id}`});
  for(const body of [{weekly_budget:7},{goal:after.goal,weekly_budget:9}]) {
    const budget=await call(`/api/employees/${id}/goal`,'PUT',body);
    assert.equal(budget.plan_baseline_gap,beforeEvidence.plan_baseline_gap); assert.equal(budget.plan_version,beforeEvidence.plan_version);
    assert.deepEqual(budget.plan_items,beforeEvidence.plan_items); assert.equal(budget.plan_progress,after.plan_progress);
  }
  if(options.restart) { await options.restart(); const persisted=await call(`/api/employees/${id}/profile`); assert.deepEqual(persisted.skills,after.skills); assert.equal(persisted.xp,after.xp); assert.equal(persisted.completion_results.length,1); assert.equal(persisted.weekly_budget,9); }
  await call('/api/session/switch','POST',{identity_id:'hr'});
  const hr=await call('/api/hr/analytics'); assert.ok(hr.participation_breakdown); assert.ok(Array.isArray(hr.catalog_gaps));
  return {profile_id:id,workspace_id:session.workspace_id,import:'PASS',preview:'PASS',same_day_completion:'PASS',budget_preservation:'PASS',duplicate_credit:'PASS',restart:options.restart?'PASS':'not_requested',completion:accepted.result,recommendations:timings};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const flag=process.argv.indexOf('--base'); const base=flag>=0?process.argv[flag+1]:'http://127.0.0.1:3000';
  acceptanceJourney(base,{live:process.argv.includes('--live'),locales:process.argv.includes('--all-locales')?['ru','kk','en']:['ru']}).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(error.message);process.exitCode=1});
}
