import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { acceptanceJourney } from '../scripts/acceptance-journey.js';

async function freePort() {
  const server=createServer(); await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=(server.address() as {port:number}).port;
  await new Promise<void>(resolve=>server.close(()=>resolve())); return port;
}
test('regression C: unknown JSON and CSV, same-day confirmed credit, preserved budget plan, duplicate and real process restart', {timeout:45000}, async()=>{
  const temp=mkdtempSync(join(tmpdir(),'cq-must-have-')); const port=await freePort(); const base=`http://127.0.0.1:${port}`;
  let child:ChildProcess|undefined;
  async function start() {
    child=spawn(process.execPath,['--import','tsx','src/server/index.ts'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATABASE_PATH:join(temp,'acceptance.sqlite'),AI_MODE:'offline',JUDGE_GATEWAY_URL:'off',OPENAI_API_KEY:'',DOTENV_CONFIG_PATH:'/dev/null'},stdio:['ignore','pipe','pipe']});
    let output=''; child.stdout?.on('data',chunk=>output+=String(chunk));child.stderr?.on('data',chunk=>output+=String(chunk));
    const deadline=Date.now()+15000;
    while(Date.now()<deadline) {
      if(child.exitCode!==null)throw Error(`Child exited: ${output}`);
      try {if((await fetch(base+'/health')).ok)return;}catch{}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    throw Error(`Startup timeout: ${output}`);
  }
  async function stop(){if(!child||child.exitCode!==null)return; const running=child; await new Promise<void>(resolve=>{running.once('exit',()=>resolve());running.kill('SIGTERM');});child=undefined;}
  try {
    await start();
    const result=await acceptanceJourney(base,{restart:async()=>{await stop();await start();}});
    assert.equal(result.restart,'PASS'); assert.equal(result.same_day_completion,'PASS'); assert.equal(result.budget_preservation,'PASS');
  } finally {await stop();rmSync(temp,{recursive:true,force:true});}
});
