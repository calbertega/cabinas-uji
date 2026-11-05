const CATALOGUE='https://cataleg.uji.es';
const AUTH_ORIGINS=new Set([CATALOGUE,'https://xmlrpc.uji.es','https://accounts.google.com']);
function allowedUjiNavigation(value){try{const u=new URL(value);return AUTH_ORIGINS.has(u.origin)&&u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function localRequestURL(target,origin){
  if(typeof target!=='string'||!target.startsWith('/')||target.startsWith('//'))return null;
  try{const url=new URL(target,origin);return url.origin===origin?url:null;}catch{return null;}
}
function allowedCatalogue(value,rooms){try{const u=new URL(value);return u.origin===CATALOGUE&&u.searchParams.get('vid')==='34CVA_UJI:VU1'&&(u.pathname==='/discovery/account'||u.pathname==='/discovery/fulldisplay'&&rooms.some(r=>r.bookingSupported&&'alma'+r.mms===u.searchParams.get('docid')));}catch{return false;}}
function trustedLocalURL(value,origin){try{const u=new URL(value);return u.origin===origin&&u.pathname==='/'&&!u.search&&!u.username&&!u.password;}catch{return false;}}
function validDay(s,now=Date.now()){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const t=Date.parse(s+'T12:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)return false;
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));return s>=today&&s<=new Date(Date.parse(today+'T12:00:00Z')+30*86400000).toISOString().slice(0,10);
}
function normalized(value,id,date,now=Date.now()){
  const t=Date.parse(value?.fetchedAt);
  if(!value?.ok||value.room!==id||value.date!==date||!Number.isFinite(t)||t>now+60000||now-t>=120000||!Array.isArray(value.events)||value.events.length>1000||value.events.some(e=>!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end>24||e.end<e.start||!['closed','unavailable'].includes(e.type)))return null;
  return {id,fetchedAt:new Date(t).toISOString(),events:value.events.map(e=>({start:e.start,end:e.end,type:e.type}))};
}
module.exports={allowedUjiNavigation,allowedCatalogue,localRequestURL,trustedLocalURL,validDay,normalized};
