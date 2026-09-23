import 'dotenv/config';
import {searchExternalOpportunities} from '../src/ai/external.js';
const start=performance.now();const result=await searchExternalOpportunities({skill_id:'SK_SYSTEM_DESIGN',skill_name:'System Design',desired_level:3,language:'ru',format:'self_paced'},{apiKey:process.env.OPENAI_API_KEY,model:'gpt-5.4-mini'});console.log(JSON.stringify({elapsed_ms:Math.round(performance.now()-start),...result}));
