import {after, test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// This suite uses only the public HTTP surface and an isolated, disposable database.
const temp = mkdtempSync(join(tmpdir(), 'cq-independent-audit-'));
process.env.DATABASE_PATH = join(temp, 'audit.sqlite');
process.env.AI_MODE = 'offline';
process.env.JUDGE_GATEWAY_URL = 'off';
delete process.env.OPENAI_API_KEY;
const {app, errorHandler} = await import('../src/server/app.js');
app.use(errorHandler);
const {db} = await import('../src/server/store.js');
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as {port:number}).port}`;
after(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  db.close();
  rmSync(temp, {recursive:true, force:true});
});

type Reply = {status:number; body:any};
function client() {
  let cookie = '';
  return {
    async request(path:string, method='GET', body?:unknown, raw=false):Promise<Reply> {
      const response = await fetch(base + path, {method,
        headers: {...(cookie ? {cookie} : {}), ...(body === undefined ? {} : {'content-type':'application/json'})},
        body: body === undefined ? undefined : raw ? String(body) : JSON.stringify(body),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      const responseText = await response.text();
      let json:any;
      try { json = JSON.parse(responseText); } catch { json = {non_json:responseText.slice(0,120)}; }
      if (response.status >= 400 && !('non_json' in json)) {
        assert.equal(typeof json.code, 'string');
        assert.equal(typeof json.user_message, 'string');
        assert.equal(typeof json.retryable, 'boolean');
        assert.equal(typeof json.request_id, 'string');
      }
      return {status:response.status, body:json};
    },
    async ok(path:string, method='GET', body?:unknown) {
      const response = await this.request(path, method, body);
      assert.equal(response.status, 200, JSON.stringify(response.body));
      return response.body;
    },
    switchTo(identity_id:string) { return this.ok('/api/session/switch', 'POST', {identity_id}); },
  };
}
function employeeFrom(profile:any, id:string) {
  return {...profile.employee, employee_id:id, full_name:`Audit ${id}`, manager_id:null};
}

test('malformed JSON and missing JSON body are client errors with stable envelope', async () => {
  const c = client();
  await c.ok('/api/session');
  const malformed = await c.request('/api/plan', 'POST', '{', true);
  assert.equal(malformed.status, 400, JSON.stringify(malformed.body));
  assert.equal(malformed.body.retryable, false);
  const missing = await c.request('/api/plan', 'POST');
  assert.equal(missing.status, 400, JSON.stringify(missing.body));
  assert.equal(missing.body.retryable, false);
});

test('unknown API route returns JSON error rather than the app HTML shell', async () => {
  const c = client();
  await c.ok('/api/session');
  const missing = await c.request('/api/no-such-endpoint');
  assert.equal(missing.status,404);
  assert.equal(typeof missing.body.code,'string',JSON.stringify(missing.body));
  assert.equal(missing.body.retryable,false);
});

test('conflicting import is all-or-none, and dangerous employee IDs are rejected', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const profile = await c.ok(`/api/employees/${session.identity.employee_id}/profile`);
  await c.switchTo('hr');
  const baseline = (await c.ok('/api/employees')).employees.length;
  const valid = employeeFrom(profile, 'AUDIT_VALID_1');
  const invalid = {...employeeFrom(profile, 'AUDIT_BAD_1'), skills:{UNKNOWN_SKILL:3}};
  const result = await c.request('/api/import/commit', 'POST', {employees:[valid, invalid]});
  assert.equal(result.status, 400);
  assert.equal((await c.ok('/api/employees')).employees.length, baseline);
  assert.equal((await c.request('/api/employees/AUDIT_VALID_1/profile')).status, 404);
  for (const id of ['__proto__', 'constructor', 'A'.repeat(81)]) {
    const preview = await c.ok('/api/import/preview', 'POST', {employees:[employeeFrom(profile, id)]});
    assert.equal(preview.valid, false, `Unsafe ID ${id} was accepted`);
    assert.ok(preview.errors.some((e:any) => e.field === 'employee_id'));
    assert.equal((await c.request('/api/import/commit', 'POST', {employees:[employeeFrom(profile, id)]})).status, 400);
  }
  assert.equal((await c.ok('/api/employees')).employees.length, baseline);
});

test('advisor cannot approve their own employee identity or self-authored quest', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const advisor = session.identities.find((x:any) => x.role === 'advisor');
  assert.ok(advisor?.employee_id);
  const catalog = await c.ok('/api/catalog');
  await c.switchTo(`employee:${advisor.employee_id}`);
  const quest = await c.ok('/api/side-quests', 'POST', {
    title:'Self authored practice', description:'A full independent example', deliverables:'Documented result',
    estimated_hours:2, source_url:null, skill_ids:[catalog.skills[0].skill_id], requires_resource:false, requires_policy:false,
  });
  await c.switchTo('advisor');
  const reviewed = await c.request(`/api/side-quests/${quest.id}/review`, 'POST', {
    action:'approve', reason:'Self approval attempt', criteria:'Review evidence', gains:[{skill_id:catalog.skills[0].skill_id,gain:1,max_level:5}],
  });
  assert.equal(reviewed.status, 403);
  assert.equal(reviewed.body.code, 'SELF_APPROVAL');
  const ownCompletion = await c.request('/api/completions', 'POST', {
    employee_id:advisor.employee_id, event_id:catalog.events.find((e:any)=>e.mandatory).event_id, evidence:'Self confirmation',
  });
  assert.equal(ownCompletion.status, 403);
});

test('different demo workspaces cannot read or mutate each other\'s imports', async () => {
  const a = client();
  const first = await a.ok('/api/session');
  const source = await a.ok(`/api/employees/${first.identity.employee_id}/profile`);
  await a.switchTo('hr');
  await a.ok('/api/import/commit', 'POST', {employees:[employeeFrom(source, 'AUDIT_ISOLATED')]});
  const b = client();
  const second = await b.ok('/api/session');
  assert.notEqual(second.workspace_id, first.workspace_id);
  await b.switchTo('hr');
  assert.equal((await b.request('/api/employees/AUDIT_ISOLATED/profile')).status, 404);
  assert.equal((await b.request('/api/assignments', 'POST', {employee_id:'AUDIT_ISOLATED',event_id:'EV_001',due_date:'2026-10-10'})).status, 404);
  assert.ok((await a.ok('/api/employees')).employees.some((e:any)=>e.employee_id==='AUDIT_ISOLATED'));
});

test('mandatory assignment enforces role, manager scope, due date and uniqueness', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const template = await c.ok(`/api/employees/${session.identity.employee_id}/profile`);
  const managerId = session.identities.find((x:any)=>x.role==='manager').employee_id;
  const id = 'AUDIT_ASSIGN_NEW';
  await c.switchTo('hr');
  await c.ok('/api/import/commit','POST',{employees:[{...employeeFrom(template,id),manager_id:managerId}]});
  const catalog = await c.ok('/api/catalog');
  const mandatory = catalog.events.find((e:any) => e.mandatory && e.target_roles.includes(template.employee.role) && e.target_grades.includes(template.employee.grade));
  assert.ok(mandatory, 'fixture needs an applicable mandatory event');
  const payload = {employee_id:id,event_id:mandatory.event_id,due_date:'2026-10-10'};
  await c.switchTo(`employee:${id}`);
  assert.equal((await c.request('/api/assignments','POST',payload)).status,403);
  await c.switchTo('hr');
  const outside = (await c.ok('/api/employees')).employees.find((e:any)=>e.manager_id!==managerId && e.employee_id!==id);
  assert.ok(outside);
  await c.switchTo('manager');
  assert.equal((await c.request('/api/assignments','POST',{...payload,employee_id:outside.employee_id})).status,403);
  await c.ok('/api/assignments','POST',payload);
  assert.equal((await c.request('/api/assignments','POST',payload)).status,400);
  const after = await c.ok(`/api/employees/${id}/profile`);
  assert.ok(after.history.some((h:any)=>h.event_id===mandatory.event_id&&h.status==='in_progress'&&h.due_date==='2026-10-10'));
});

test('impossible due date is rejected before writing assignment', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const template = await c.ok(`/api/employees/${session.identity.employee_id}/profile`);
  const managerId = session.identities.find((x:any)=>x.role==='manager').employee_id;
  const id = 'AUDIT_INVALID_DUE';
  await c.switchTo('hr');
  await c.ok('/api/import/commit','POST',{employees:[{...employeeFrom(template,id),manager_id:managerId}]});
  const catalog = await c.ok('/api/catalog');
  const mandatory = catalog.events.find((e:any)=>e.mandatory&&e.target_roles.includes(template.employee.role)&&e.target_grades.includes(template.employee.grade));
  assert.ok(mandatory);
  await c.switchTo('manager');
  const result = await c.request('/api/assignments','POST',{employee_id:id,event_id:mandatory.event_id,due_date:'2026-12-32'});
  assert.equal(result.status,400,JSON.stringify(result.body));
  const after = await c.ok(`/api/employees/${id}/profile`);
  assert.ok(!after.history.some((h:any)=>h.due_date==='2026-12-32'));
});

test('scheduled completion needs an occurred catalog session and records actual confirmation date', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const id = session.identity.employee_id;
  await c.switchTo('advisor');
  const payload = {employee_id:id,event_id:'EV_036',session:'2026-10-08',evidence:'Short talk reviewed with feedback'};
  assert.equal((await c.request('/api/completions','POST',payload)).status,400);
  await c.ok('/api/demo/date','POST',{as_of:'2026-10-09'});
  const first = await c.ok('/api/completions','POST',payload);
  assert.equal(first.duplicate,false);
  const after = await c.ok(`/api/employees/${id}/profile`);
  assert.ok(after.history.some((h:any)=>h.event_id==='EV_036'&&h.date==='2026-10-08'&&h.completed_at==='2026-10-09'&&h.completion_time_quality==='exact'));
  const repeat = await c.ok('/api/completions','POST',payload);
  assert.equal(repeat.duplicate,true);
});

test('goal changes cannot create XP or a completion credit', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const id = session.identity.employee_id;
  const before = await c.ok(`/api/employees/${id}/profile`);
  const after = await c.ok(`/api/employees/${id}/goal`,'PUT',{goal:null,weekly_budget:3});
  assert.equal(after.goal,null);
  const final = await c.ok(`/api/employees/${id}/profile`);
  assert.equal(final.xp,before.xp);
  assert.equal(final.balance,before.balance);
  assert.equal(final.history.length,before.history.length);
});

test('concurrent redemptions cannot overspend; reused key cannot change reward', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  await c.switchTo('advisor');
  await c.ok('/api/side-quests/DEMO_Q_EVIDENCE/accept','POST',{reason:'Evidence checked independently'});
  await c.switchTo('employee');
  const before = await c.ok('/api/rewards');
  assert.ok(before.balance>=20 && before.balance<40, `Fixture balance ${before.balance} must fund exactly one redemption`);
  const [left,right] = await Promise.all([
    c.request('/api/rewards/mentor/redeem','POST',{idempotency_key:'concurrent-left'}),
    c.request('/api/rewards/mentor/redeem','POST',{idempotency_key:'concurrent-right'}),
  ]);
  assert.deepEqual([left.status,right.status].sort(),[200,409]);
  const after = await c.ok('/api/rewards');
  assert.equal(after.balance,before.balance-20);
  assert.equal(after.ledger.filter((x:any)=>x.amount<0).length,1);
  const successKey = left.status===200?'concurrent-left':'concurrent-right';
  assert.equal((await c.request('/api/rewards/project/redeem','POST',{idempotency_key:successKey})).status,409);
});

test('accepted evidence cannot be reused for a second credit', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const id = session.identity.employee_id;
  const quests = await c.ok('/api/side-quests');
  const acceptedEvidence = quests.quests.find((q:any)=>q.id==='DEMO_Q_EVIDENCE').evidence;
  const originalSkill = quests.quests.find((q:any)=>q.id==='DEMO_Q_EVIDENCE').skill_ids[0];
  await c.switchTo('advisor');
  await c.ok('/api/side-quests/DEMO_Q_EVIDENCE/accept','POST',{reason:'Result and evidence checked'});
  await c.switchTo('employee');
  const proposal = await c.ok('/api/side-quests','POST',{
    title:'Another practice',description:'Independent task candidate',deliverables:'A written result',
    skill_ids:[originalSkill],estimated_hours:2,requires_resource:false,requires_policy:false,
  });
  await c.switchTo('advisor');
  await c.ok(`/api/side-quests/${proposal.id}/review`,'POST',{
    action:'approve',reason:'Proposal reasonable',criteria:'Inspect result',gains:[{skill_id:originalSkill,gain:1,max_level:5}],
  });
  await c.switchTo('employee');
  assert.equal((await c.request(`/api/side-quests/${proposal.id}/evidence`,'POST',{evidence:acceptedEvidence})).status,400);
  assert.equal((await c.ok(`/api/employees/${id}/profile`)).xp,35);
});

test('needs_revision proposal can be edited and resubmitted by its author', async () => {
  const c = client();
  await c.ok('/api/session');
  await c.switchTo('advisor');
  const revised = await c.ok('/api/side-quests/DEMO_Q_REVIEW/review','POST',{action:'revise',reason:'Add measurable deliverable'});
  assert.equal(revised.status,'needs_revision');
  await c.switchTo('employee');
  const updated = await c.request('/api/side-quests/DEMO_Q_REVIEW/resubmit','POST',{
    title:'Revised practice proposal',description:'Specific independently verifiable work',deliverables:'A report and test case',
    estimated_hours:4,source_url:null,skill_ids:revised.skill_ids,requires_resource:false,requires_policy:false,
  });
  assert.equal(updated.status,200,JSON.stringify(updated.body));
  assert.equal(updated.body.status,'submitted');
});

test('evidence revision loop preserves approval and grants credit only after acceptance', async () => {
  const c = client();
  const session = await c.ok('/api/session');
  const id = session.identity.employee_id;
  const before = await c.ok(`/api/employees/${id}/profile`);
  await c.switchTo('advisor');
  const revised = await c.ok('/api/side-quests/DEMO_Q_EVIDENCE/review','POST',{action:'revise',reason:'Explain how the test result was reproduced'});
  assert.equal(revised.status,'needs_revision');
  await c.switchTo('employee');
  const afterRevision = await c.ok(`/api/employees/${id}/profile`);
  assert.equal(afterRevision.xp,before.xp);
  const resubmitted = await c.ok('/api/side-quests/DEMO_Q_EVIDENCE/evidence','POST',{evidence:'Revised demonstration: reproducible steps, output and advisor discussion.'});
  assert.equal(resubmitted.status,'evidence_submitted');
  await c.switchTo('advisor');
  await c.ok('/api/side-quests/DEMO_Q_EVIDENCE/accept','POST',{reason:'Revised evidence checked'});
  const accepted = await c.ok(`/api/employees/${id}/profile`);
  assert.ok(accepted.xp>before.xp);
});
