import { loadSourceDataset, buildProfile, validateImport } from '../src/domain/index.js';
import { judgeRecommendation } from '../src/server/gateway.js';
const dataset = loadSourceDataset();
const existing = dataset.employees.map(e => buildProfile(dataset,e.employee_id)).find(p=>p.candidates.filter(c=>c.eligible&&(c.U>0||c.B>0)).length>=2);
if (!existing) throw new Error('No useful source profile');
const employee={...existing.employee,employee_id:'JUDGE_SMOKE_NEW',full_name:'Demo smoke profile',manager_id:null};
const validated=validateImport(dataset,{employees:[employee],history:[]});
if(!validated.valid)throw new Error('New profile validation failed');
dataset.employees.push(...validated.employees);
const profile=buildProfile(dataset,employee.employee_id);
const locales = process.argv.includes('--all-locales') ? ['ru','kk','en'] as const : ['ru'] as const;
for (const locale of locales) {
  const started=performance.now();
  const result=await judgeRecommendation(profile, 'judge-language-smoke', locale);
  const evidence={locale,returned_locale:result.locale,mode:result.mode,model:result.model,latency_ms:Math.round(performance.now()-started),recommendations:result.recommendations.map(r=>({event_id:r.event_id,factor_keys:r.factor_keys,alternative_event_id:r.alternative_event_id,summary:r.summary})),warnings:result.warnings,usage:result.usage};
  console.log(JSON.stringify(evidence));
  if(!['live_ai','cached_live_ai'].includes(result.mode) || (locales.length>1 && result.locale!==locale))process.exitCode=1;
}
