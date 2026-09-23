import type {Profile,RecommendationResult} from '../shared/types.js';
import {recommend} from '../ai/index.js';
const defaultUrl='https://career.aiviom.ai';
let gatewayCookie='';
export async function judgeRecommendation(profile:Profile):Promise<RecommendationResult>{
 const configured=process.env.JUDGE_GATEWAY_URL;
 if(configured==='off'||process.env.AI_MODE==='offline')return recommend(profile);
 const base=configured||defaultUrl;
 try{
  const endpoint=new URL(base);if(endpoint.protocol!=='https:'&&endpoint.hostname!=='127.0.0.1')throw new Error('Unsafe gateway');
  if(!gatewayCookie){const session=await fetch(new URL('/api/session',endpoint),{signal:AbortSignal.timeout(6000)});if(!session.ok)throw new Error('Gateway session unavailable');gatewayCookie=session.headers.get('set-cookie')?.split(';')[0]||'';if(!gatewayCookie)throw new Error('Gateway scope unavailable');}
  const response=await fetch(new URL('/api/judge/recommend',endpoint),{method:'POST',headers:{'Content-Type':'application/json',cookie:gatewayCookie},body:JSON.stringify({employee:{...profile.employee,skills:profile.skills,last_review_date:profile.as_of},history:profile.history,goal:profile.goal,as_of:profile.as_of}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Gateway unavailable');
  const result=await response.json() as RecommendationResult;
  const eligible=new Set(profile.candidates.filter(c=>c.eligible&&!c.event.mandatory).map(c=>c.event.event_id));
  if(!Array.isArray(result.recommendations)||result.recommendations.some(r=>!eligible.has(r.event_id)))throw new Error('Gateway facts mismatch');
  return result;
 }catch{const result=await recommend(profile);return {...result,warnings:['Командный AI gateway недоступен; показан расчётный режим.',...result.warnings]};}
}
