import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const temp=mkdtempSync(join(tmpdir(),'cq-test-'));process.env.DATABASE_PATH=join(temp,'test.sqlite');delete process.env.OPENAI_API_KEY;process.env.AI_MODE='offline';
const {app,errorHandler}=await import('../src/server/app.js');app.use(errorHandler);
const {db,readState}=await import('../src/server/store.js');
const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${(server.address()as any).port}`;
let cookie='';
async function call(path:string,method='GET',body?:unknown,expected=200){const r=await fetch(base+path,{method,headers:{cookie,...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie')!.split(';')[0];const json=await r.json();assert.equal(r.status,expected,JSON.stringify(json));return json;}
const switchTo=(identity_id:string)=>call('/api/session/switch','POST',{identity_id});
test('isolated workspace, server RBAC, completion, quest, rewards and import are transactional',async()=>{
 try{
 const session=await call('/api/session');const id=session.identity.employee_id;const before=await call(`/api/employees/${id}/profile`);assert.ok(before.gaps.length);assert.ok(before.candidates.length);
 await call('/api/import/preview','POST',{employees:[]},403);
 await call('/api/side-quests/DEMO_Q_EVIDENCE/accept','POST',{reason:'self approval'},403);
 const pBefore=JSON.stringify(readState(session.workspace_id));const event=before.candidates.find((c:any)=>c.eligible&&c.event.format==='self_paced'&&c.U>0);assert.ok(event,'demo has useful self paced event');
 await call(`/api/employees/${id}/preview`,'POST',{event_id:event.event.event_id});assert.equal(JSON.stringify(readState(session.workspace_id)),pBefore,'preview does not mutate');
 await call('/api/completion-requests','POST',{employee_id:id,event_id:event.event.event_id,evidence:'Выполнены задания, подготовлен разбор.'});
 await call('/api/completions','POST',{employee_id:id,event_id:event.event.event_id,evidence:'forged',role:'hr'},403);
 await switchTo('advisor');const requests=await call('/api/completion-requests');const rid=requests.requests[0].id;
 const first=await call(`/api/completion-requests/${rid}/accept`,'POST',{reason:'Проверено наставником'});assert.ok(first.xp>=20);
 const second=await call(`/api/completion-requests/${rid}/accept`,'POST',{reason:'Повтор'});assert.equal(second.duplicate,true);
 const after=await call(`/api/employees/${id}/profile`);assert.ok(after.coverage>=before.coverage);assert.ok(after.xp>=20);
 const originalXp=after.xp;await call('/api/side-quests/DEMO_Q_REVIEW/review','POST',{action:'approve',reason:'Подход подходит',criteria:'Проверка результата',gains:[{skill_id:before.gaps.find((g:any)=>g.gap>0).skill_id,gain:1,max_level:5}]});
 assert.equal((await call(`/api/employees/${id}/profile`)).xp,originalXp,'idea approval no reward');
 await call('/api/side-quests/DEMO_Q_EVIDENCE/accept','POST',{reason:'Проверен пример и объяснение'});const once=(await call(`/api/employees/${id}/profile`)).xp;
 await call('/api/side-quests/DEMO_Q_EVIDENCE/accept','POST',{reason:'Повтор'});assert.equal((await call(`/api/employees/${id}/profile`)).xp,once);
 await switchTo('manager');await call('/api/side-quests/DEMO_Q_RESOURCE/resource','POST',{action:'approve',reason:'Выделены4часа'});
 await call('/api/side-quests/DEMO_Q_POLICY/policy','POST',{action:'approve',reason:'forbidden'},403);
 await switchTo('supervisor');await call('/api/side-quests/DEMO_Q_POLICY/policy','POST',{action:'approve',reason:'Критерии соответствуют требованиям'});
 await switchTo('employee');const rewards=await call('/api/rewards');assert.ok(rewards.balance>=20);
 await call('/api/rewards/mentor/redeem','POST',{idempotency_key:'same'});await call('/api/rewards/mentor/redeem','POST',{idempotency_key:'same'});assert.equal((await call('/api/rewards')).balance,rewards.balance-20);
 await switchTo('hr');const imported={...before.employee,employee_id:'JUDGE_NEW_1',full_name:'Regression profile',manager_id:'UNKNOWN_MANAGER'};const preview=await call('/api/import/preview','POST',{employees:[imported]});assert.equal(preview.valid,true,JSON.stringify(preview));
 await call('/api/import/commit','POST',{employees:[imported]});await call('/api/import/commit','POST',{employees:[imported]});assert.equal((await call('/api/employees')).employees.filter((e:any)=>e.employee_id==='JUDGE_NEW_1').length,1);
 await switchTo('employee:JUDGE_NEW_1');const rec=await call('/api/employees/JUDGE_NEW_1/recommendations','POST');assert.ok(['rules_fallback','unavailable'].includes(rec.mode));
 await call(`/api/employees/${id}/profile`,'GET',undefined,403);
 await switchTo('hr');const analytics=await call('/api/hr/analytics');assert.equal(analytics.scope.profiles,201);
 const oldCookie=cookie;cookie='';const separate=await call('/api/session');assert.notEqual(separate.workspace_id,session.workspace_id);await switchTo('hr');assert.equal((await call('/api/employees')).employees.length,200);cookie=oldCookie;
 assert.equal(readState(session.workspace_id).dataset.employees.length,201,'state persisted');
 }finally{await new Promise<void>(r=>server.close(()=>r()));db.close();rmSync(temp,{recursive:true,force:true});}
});
