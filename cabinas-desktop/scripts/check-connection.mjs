import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {ConnectionController}=createRequire(import.meta.url)('../desktop/connection.cjs');
const NOW=Date.parse('2026-10-31T09:00:00Z'),day='2026-11-02';let checks=0;
const good=id=>({ok:true,room:id,date:day,fetchedAt:new Date(NOW).toISOString(),events:[{start:0,end:8,type:'closed'}]});
function setup(overrides={},rooms=[{id:207},{id:209}]){
 const messages=[],calls=[];const adapter={prepare:async()=>calls.push('prepare'),advance:async()=>'ready',reveal:async()=>calls.push('reveal'),hide:async()=>calls.push('hide'),read:async(_day,id)=>good(id),close:async()=>calls.push('close'),clearSession:async()=>calls.push('clear'),...overrides};
 return {controller:new ConnectionController({adapter,rooms,emit:m=>messages.push(m),now:()=>NOW,sleep:async()=>{},limits:{step:25,open:25,read:25}}),messages,calls,adapter};
}
function check(v,label){assert.ok(v,label);checks++;}
let s=setup({read:async(_d,id)=>id===207?{ok:false,code:'unverified'}:good(id)});
await s.controller.start({requestId:'first-unverified',date:day});check(s.messages.at(-1).type==='done'&&s.messages.at(-1).verified===1,'First room unverified does not hide a later valid room');
check(s.messages.find(m=>m.room?.id===207).room.error===true,'Unknown room is never free');
let attempts=0;s=setup({read:async(_d,id)=>{attempts++;return attempts===1?{ok:false,code:'connection'}:good(id);}});
await s.controller.start({requestId:'retry-transport',date:day});check(attempts===3&&s.messages.at(-1).type==='done','Transient request retries once and completes');
s=setup({read:async()=>({ok:false,code:'connection'})},[207,209,210,211,212].map(id=>({id})));
await s.controller.start({requestId:'offline-transport',date:day});check(s.messages.filter(m=>m.type==='progress').length===3&&s.messages.at(-1).type==='error','Stops repeated offline failures');
s=setup({read:async()=>({ok:false,code:'unverified'})});await s.controller.start({requestId:'all-blocked',date:day});check(s.messages.at(-1).code==='unverified','No success with zero verified rooms');
let completeOld,started;const readingStarted=new Promise(r=>{started=r;});s=setup({read:(_d,id)=>new Promise(r=>{completeOld=r;started();})});
const oldRun=s.controller.start({requestId:'old-date',date:day});await readingStarted;
s.controller.cancel('old-date');s.adapter.read=async(_d,id)=>good(id);
const newRun=s.controller.start({requestId:'new-date',date:day});completeOld(good(207));await Promise.all([oldRun,newRun]);
check(!s.messages.some(m=>m.requestId==='old-date'&&m.type==='progress'),'Late old response is discarded');check(s.messages.at(-1).requestId==='new-date'&&s.messages.at(-1).type==='done','Replacement runs after old page operation settles');
check(s.calls.filter(x=>x==='prepare').length===2,'New query reacquires an account context');
s=setup({advance:async()=> 'closed'});await s.controller.start({requestId:'closed-window',date:day});check(s.messages.at(-1).code==='connection','Closed window terminates current job');
s=setup({advance:()=>new Promise(()=>{})});await s.controller.start({requestId:'hung-page',date:day});check(s.messages.at(-1).code==='timeout','Unresponsive page is bounded');
let stage=0;s=setup({advance:async()=>stage++?'ready':'login'});await s.controller.start({requestId:'login-resume',date:day});check(s.messages.some(m=>m.type==='login')&&s.messages.at(-1).type==='done','Normal login handoff resumes without another click');
s=setup();check(await s.controller.reset(),'Reset completes');check(s.calls.join(',')==='close,clear','Windows close before session clearing');
s=setup({clearSession:async()=>{throw Error('private details');}});check(!await s.controller.reset()&&s.controller.resetFailed,'Reset failure stays explicit');check(!await s.controller.start({requestId:'after-failed-reset',date:day}),'Cannot silently reuse a failed reset');
s=setup({read:async(_d,id)=>({...good(id),fetchedAt:new Date(NOW-121000).toISOString()})});await s.controller.start({requestId:'stale-data',date:day});check(s.messages.every(m=>m.type!=='progress'||m.room.error)&&s.messages.at(-1).code==='unverified','Old cached responses remain unknown');
console.log(JSON.stringify({checks,passed:true,scope:'connection-lifecycle-with-controlled-adapter'}));
