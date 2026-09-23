import Database from 'better-sqlite3';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Credit,Dataset,Goal,Identity,Levels,Quest} from '../shared/types.js';
import {buildProfile,loadSourceDataset} from '../domain/index.js';

export interface Plan {goal:Goal|null;baseline_gap:number;version:number;weekly_budget:number;items:string[]}
export interface Help {id:string;employee_id:string;event_id:string|null;reason:string;status:string;resolution?:string}
export interface CompletionRequest {id:string;employee_id:string;event_id:string;session:string|null;evidence:string;status:string;created_at:string}
export interface Ledger {id:string;employee_id:string;amount:number;source:string;created_at:string;reward_id?:string}
export interface Audit {id:string;actor:string;action:string;target:string;reason:string;at:string}
export interface State {version:number;as_of:string;dataset:Dataset;credits:Credit[];quests:Quest[];plans:Record<string,Plan>;help:Help[];completion_requests:CompletionRequest[];ledger:Ledger[];audit:Audit[];lifetime_max:Record<string,Levels>;advisor_assignments:Record<string,string[]>;primary_employee:string;manager_employee:string|null}
const path=process.env.DATABASE_PATH||'.runtime/career-quest.sqlite';
mkdirSync(dirname(path),{recursive:true});
export const db=new Database(path);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.exec(`CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY,state TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,identity_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS credits_guard (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,credit_key TEXT NOT NULL,PRIMARY KEY(workspace_id,credit_key));
CREATE TABLE IF NOT EXISTS ai_usage (id TEXT PRIMARY KEY,at TEXT NOT NULL,workspace_id TEXT NOT NULL,model TEXT NOT NULL,reserved_usd REAL NOT NULL,actual_usd REAL,input_tokens INTEGER,output_tokens INTEGER,status TEXT NOT NULL);`);
let original:Dataset|undefined;
export function source(){return original??=loadSourceDataset();}
export const stamp=()=>new Date().toISOString();
export function seed():State {
 const dataset=structuredClone(source());
 const ranked=dataset.employees.filter(e=>e.manager_id).map(e=>buildProfile(dataset,e.employee_id)).sort((a,b)=>b.candidates.filter(c=>c.eligible&&c.U>0).length-a.candidates.filter(c=>c.eligible&&c.U>0).length);
 const primary=ranked.find(p=>p.gaps.some(g=>g.gap>0&&g.current<5))||ranked[0];
 const emp=primary.employee;
 const s:State={version:1,as_of:'2026-10-01',dataset,credits:[],quests:[],plans:{},help:[],completion_requests:[],ledger:[],audit:[],lifetime_max:{},advisor_assignments:{advisor:dataset.employees.map(e=>e.employee_id)},primary_employee:emp.employee_id,manager_employee:emp.manager_id};
 const skill=primary.gaps.find(g=>g.gap>0&&g.current<5)!;
 const quest=(id:string,title:string,status:string,resource=false,policy=false):Quest=>({id,employee_id:emp.employee_id,title,description:'Демо-расширение AIVIOM: практическая работа для подтверждения компетенции.',deliverables:'Краткий отчёт, воспроизводимый пример и разбор с наставником.',estimated_hours:4,source_url:null,skill_ids:[skill.skill_id],gains:[{skill_id:skill.skill_id,gain:1,max_level:Math.min(5,skill.current+1)}],criteria:'Наставник проверяет самостоятельность решения, воспроизводимость результата и объяснение принятых решений.',status,requires_resource:resource,requires_policy:policy,resource_approved:!resource,policy_approved:!policy,advisor_approved:status!=='submitted',evidence:status==='evidence_submitted'?'Демо-доказательство: подготовлен разбор решения и проверочный пример. Это синтетическая заявка для проверки workflow.':'',decisions:[],created_at:stamp(),version:1});
 s.quests=[quest('DEMO_Q_REVIEW','Практический разбор: предложение','submitted'),quest('DEMO_Q_EVIDENCE','Практический разбор: результат','evidence_submitted'),quest('DEMO_Q_RESOURCE','Время на практику с наставником','resource_review',true),quest('DEMO_Q_POLICY','Новый способ подтверждения компетенции','policy_review',false,true)];
 s.help=[{id:'DEMO_HELP',employee_id:emp.employee_id,event_id:null,reason:'Нужно согласовать 4 часа на развитие на этой неделе.',status:'open'}];
 for(const e of dataset.employees){const p=buildProfile(dataset,e.employee_id);s.lifetime_max[e.employee_id]={...p.skills};s.plans[e.employee_id]={goal:p.goal,baseline_gap:p.total_gap,version:1,weekly_budget:4,items:[]};}
 return s;
}
export function identities(s:State):Identity[]{return [{id:'employee',label:'Сотрудник · '+s.dataset.employees.find(e=>e.employee_id===s.primary_employee)!.full_name,role:'employee',employee_id:s.primary_employee},{id:'advisor',label:'Наставник программы',role:'advisor',employee_id:s.dataset.employees.find(e=>e.employee_id!==s.primary_employee&&e.employee_id!==s.manager_employee)!.employee_id},{id:'manager',label:'Менеджер команды',role:'manager',employee_id:s.manager_employee},{id:'hr',label:'HR-менеджер',role:'hr',employee_id:null},{id:'supervisor',label:'Супервайзер программы',role:'supervisor',employee_id:null}];}
export function identity(s:State,id:string):Identity|undefined{return identities(s).find(x=>x.id===id)||(id.startsWith('employee:')&&s.dataset.employees.some(e=>e.employee_id===id.slice(9))?{id,label:s.dataset.employees.find(e=>e.employee_id===id.slice(9))!.full_name,role:'employee',employee_id:id.slice(9)}:undefined);}
export function createSession(){const workspace=randomUUID(),id=randomUUID(),state=seed();db.transaction(()=>{db.prepare('INSERT INTO workspaces VALUES (?,?,?)').run(workspace,JSON.stringify(state),stamp());db.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run(id,workspace,'employee',stamp());})();return id;}
export function session(id:string){return db.prepare('SELECT * FROM sessions WHERE id=?').get(id) as {id:string;workspace_id:string;identity_id:string}|undefined;}
export function readState(workspace:string):State {const row=db.prepare('SELECT state FROM workspaces WHERE id=?').get(workspace) as {state:string}|undefined;if(!row)throw new Error('Workspace missing');return JSON.parse(row.state);}
export function mutate<T>(workspace:string,fn:(s:State)=>T):T{return db.transaction(()=>{const s=readState(workspace);const result=fn(s);s.version++;db.prepare('UPDATE workspaces SET state=? WHERE id=?').run(JSON.stringify(s),workspace);return result;}).immediate();}
export function audit(s:State,actor:string,action:string,target:string,reason=''){s.audit.push({id:randomUUID(),actor,action,target,reason,at:stamp()});}
export function guard(workspace:string,key:string){return db.prepare('INSERT OR IGNORE INTO credits_guard VALUES (?,?)').run(workspace,key).changes===1;}
export function profile(s:State,id:string){const p=s.plans[id];return buildProfile(s.dataset,id,{asOf:s.as_of,...(p?{goal:p.goal}:{}),credits:s.credits});}
export function creditReward(s:State,employee:string,sourceId:string,before:Levels,after:Levels){const max=s.lifetime_max[employee]??before;let boundaries=0;for(const [key,value]of Object.entries(after)){boundaries+=Math.max(0,Math.floor(value)-Math.floor(max[key]??before[key]??0));max[key]=Math.max(max[key]??0,value);}s.lifetime_max[employee]=max;const xp=20+15*boundaries;s.ledger.push({id:randomUUID(),employee_id:employee,amount:xp,source:sourceId,created_at:stamp()});return xp;}
