const {normalized}=require('./policy.cjs');
class ConnectionFailure extends Error{constructor(code){super(code);this.code=code;}}
class ConnectionController{
 constructor({adapter,rooms,emit,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),limits={}}){
  this.adapter=adapter;this.rooms=rooms;this.emit=emit;this.now=now;this.sleep=sleep;
  this.limits={total:900000,open:45000,step:16000,read:20000,interval:1000,...limits};
  this.job=null;this.serial=Promise.resolve();this.resetting=false;this.resetFailed=false;
 }
 active(j){return this.job===j&&!this.resetting;}
 send(j,m){if(this.active(j))this.emit({requestId:j.id,date:j.date,...m});}
 finish(j,m){if(!this.active(j))return;this.send(j,m);this.job=null;}
 bounded(operation,ms){return new Promise((resolve,reject)=>{let settled=false;const t=setTimeout(()=>{settled=true;reject(new ConnectionFailure('timeout'));},ms);Promise.resolve().then(operation).then(v=>{if(!settled){settled=true;clearTimeout(t);resolve(v);}},()=>{if(!settled){settled=true;clearTimeout(t);reject(new ConnectionFailure('connection'));}});});}
 cancel(id){const j=this.job;if(j&&(!id||j.id===id))this.finish(j,{type:'cancelled'});}
 start({requestId:id,date}){
  if(this.resetting||this.resetFailed)return Promise.resolve(false);
  this.cancel();const j={id,date,deadline:this.now()+this.limits.total};this.job=j;
  this.serial=this.serial.catch(()=>{}).then(()=>this.run(j));return this.serial;
 }
 async run(j){
  if(!this.active(j))return;
  try{
   this.send(j,{type:'opening'});
   // Obtain a new reader context each run: do not reuse an old account's link
   // or mistake a previously rendered form for a still-valid sign-in.
   await this.bounded(()=>this.adapter.prepare(),this.limits.open);
   if(!this.active(j))return;
   let loginShown=false;
   while(this.active(j)&&this.now()<j.deadline){
    const stage=await this.bounded(()=>this.adapter.advance(),this.limits.step);
    if(!this.active(j))return;
    if(stage==='ready'){this.send(j,{type:'reading'});await this.collect(j);return;}
    if(['login','navigating'].includes(stage)&&!loginShown){await this.adapter.reveal();this.send(j,{type:'login'});loginShown=true;}
    if(stage==='calendar_missing')throw new ConnectionFailure('calendar_missing');
    if(stage==='closed')throw new ConnectionFailure('connection');
    await this.sleep(this.limits.interval);
   }
   if(this.active(j))throw new ConnectionFailure('timeout');
  }catch(e){if(this.active(j)){await this.adapter.reveal().catch(()=>{});this.finish(j,{type:'error',code:e instanceof ConnectionFailure?e.code:'connection',tabKept:true});}}
 }
 async collect(j){
  let good=0,transportFailures=0;
  for(let i=0;i<this.rooms.length&&this.active(j);i++){
   if(this.now()>=j.deadline)throw new ConnectionFailure('timeout');
   const room=this.rooms[i];let value,item=null;
   for(let attempt=0;attempt<2&&this.active(j);attempt++){
    try{value=await this.bounded(()=>this.adapter.read(j.date,room.id),this.limits.read);}catch{value={ok:false,code:'connection'};}
    if(!this.active(j))return;
    item=normalized(value,room.id,j.date,this.now());
    if(item||value?.code!=='connection')break;
    if(attempt===0)await this.sleep(300);
   }
   if(!this.active(j))return;
   if(item){good++;transportFailures=0;}
   else if(['open_calendar','wrong_origin','unknown_room'].includes(value?.code))throw new ConnectionFailure('calendar_missing');
   else if(value?.code==='connection')transportFailures++;else transportFailures=0;
   this.send(j,{type:'progress',done:i+1,total:this.rooms.length,room:item||{id:room.id,error:true,reason:'calendar_unverified',events:[]}});
   // A room-specific eligibility block does not invalidate the other rooms.
   // Repeated transport failures do not trigger dozens of identical requests.
   if(transportFailures>=3)throw new ConnectionFailure('connection');
  }
  if(!this.active(j))return;
  if(!good)throw new ConnectionFailure('unverified');
  await this.adapter.hide();this.finish(j,{type:'done',verified:good,total:this.rooms.length});
 }
 async reset(){
  if(this.resetting)return false;
  this.cancel();this.resetting=true;
  try{
   // Closing the official windows aborts in-flight page work before clearing
   // their partition. Old completions cannot emit into a replacement job.
   await this.adapter.close();
   await this.bounded(()=>this.adapter.clearSession(),30000);
   this.resetFailed=false;return true;
  }catch{this.resetFailed=true;return false;}
  finally{this.resetting=false;}
 }
}
module.exports={ConnectionController,ConnectionFailure};
