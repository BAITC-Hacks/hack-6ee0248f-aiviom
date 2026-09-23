import {randomUUID} from 'node:crypto';
import {db,stamp} from './store.js';
import {requireThat} from './errors.js';
const MAX_RESERVATION=0.05;
export function reserveAi(workspace:string,model:string){return db.transaction(()=>{const used=db.prepare('SELECT COALESCE(SUM(COALESCE(actual_usd,reserved_usd)),0) AS total FROM ai_usage').get() as {total:number};const limit=Number(process.env.AI_BUDGET_USD||30);requireThat(used.total+MAX_RESERVATION<=limit,'Общий лимит AI достигнут. Доступен расчётный режим.',429,'AI_BUDGET');const recent=db.prepare("SELECT COUNT(*) AS n FROM ai_usage WHERE workspace_id=? AND at>?").get(workspace,new Date(Date.now()-60000).toISOString())as{n:number};requireThat(recent.n<6,'Не более 6 AI-запросов в минуту. Попробуйте позже.',429,'RATE_LIMIT');const id=randomUUID();db.prepare('INSERT INTO ai_usage (id,at,workspace_id,model,reserved_usd,status) VALUES (?,?,?,?,?,?)').run(id,stamp(),workspace,model,MAX_RESERVATION,'reserved');return id;}).immediate();}
export function settleAi(id:string,result:{mode:string;usage?:{input_tokens:number;output_tokens:number}}){
 // Conservative reservation remains charged if exact pricing/usage is unknown. No zero-cost assumption.
 if(result.mode==='cached_live_ai'){db.prepare('UPDATE ai_usage SET actual_usd=0,status=? WHERE id=?').run('cache',id);return;}
 db.prepare('UPDATE ai_usage SET input_tokens=?,output_tokens=?,status=? WHERE id=?').run(result.usage?.input_tokens??null,result.usage?.output_tokens??null,result.mode,id);
}
