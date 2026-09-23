import 'dotenv/config';
import { loadSourceDataset, buildProfile, validateImport } from '../src/domain/index.js';
import { recommend } from '../src/ai/index.js';
import { LOCALES } from '../src/shared/locale.js';
import { writeFileSync, mkdirSync } from 'node:fs';

if (!process.env.OPENAI_API_KEY) throw new Error('Set a server-side OPENAI_API_KEY before this explicitly paid smoke.');
const dataset = loadSourceDataset();
const source = dataset.employees.map(e => buildProfile(dataset,e.employee_id))
  .find(p => p.candidates.filter(c => c.eligible && !c.event.mandatory && c.U > 0).length >= 2);
if (!source) throw new Error('No suitable source profile.');
const incoming = {...source.employee, employee_id:'ATLAS_LIVE_NEW', full_name:'Atlas language verification', manager_id:null};
const imported = validateImport(dataset,{employees:[incoming],history:[]});
if (!imported.valid) throw new Error('Smoke import failed.');
dataset.employees.push(...imported.employees);
const profile = buildProfile(dataset,incoming.employee_id);
const results = [];
for (const locale of LOCALES) {
  const started = performance.now();
  const result = await recommend(profile,{apiKey:process.env.OPENAI_API_KEY,locale,model:process.env.OPENAI_MODEL || 'gpt-5.4-mini'});
  const evidence = {locale,returned_locale:result.locale,mode:result.mode,latency_ms:Math.round(performance.now()-started),model:result.model,usage:result.usage,
    recommendations:result.recommendations.map(r=>({event_id:r.event_id,summary:r.summary,alternative_reason:r.alternative_reason,factors:r.factor_keys,facts:r.facts})),warnings:result.warnings};
  results.push(evidence);console.log(JSON.stringify(evidence));
  if (result.mode !== 'live_ai' || result.locale !== locale || result.recommendations.some(r => r.factor_keys.length !== 4 || !r.summary || r.facts?.length !== 4)) process.exitCode=1;
}
mkdirSync('.runtime',{recursive:true});
writeFileSync('.runtime/rebrand-live-receipt.json',JSON.stringify({checked_at:new Date().toISOString(),results},null,2));
