const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const icon=n=>'<svg class="icon" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
const madridClock=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const parts=()=>Object.fromEntries(madridClock.formatToParts(new Date()).map(p=>[p.type,p.value]));
const dayString=()=>{const p=parts();return p.year+'-'+p.month+'-'+p.day};
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const hh=h=>{const m=Math.round(h*60);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')};
const shortDate=s=>new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',timeZone:'Europe/Madrid'}).format(new Date(s+'T12:00:00Z'));
const longDate=s=>new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Madrid'}).format(new Date(s+'T12:00:00Z'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const planUrls={1:'https://www.uji.es/upo/rest/contenido/644305285/raw?idioma=ca',2:'https://www.uji.es/upo/rest/contenido/644305293/raw?idioma=ca',3:'https://www.uji.es/upo/rest/contenido/644305306/raw?idioma=ca',5:'https://www.uji.es/upo/rest/contenido/1015359380/raw?idioma=ca'};
const CALENDAR_MAX_AGE=120000;
let personalConnector=null;
let today=dayString(),selectedDay=today,rooms=[],data={},floor='all',selected=207,view=matchMedia('(max-width:760px)').matches?'cards':'schedule',loading=false,generation=0,updatedAt=null,failed=0,mode='campus',nowMode=false,lastLoadAt=0,lastLoadDate=null,calendarNeedsReload=false;
const p=parts();let initialHour=Number(p.hour)+Number(p.minute)/60;
if(initialHour>=20||[0,6].includes(new Date(today+'T12:00:00Z').getUTCDay())){do{selectedDay=addDays(selectedDay,1)}while([0,6].includes(new Date(selectedDay+'T12:00:00Z').getUTCDay()));initialHour=8}else initialHour=Math.max(8,Math.ceil(initialHour*2)/2);
$('#date').min=today;$('#date').max=addDays(today,30);$('#date').value=selectedDay;
for(let h=8;h<20;h+=.5)$('#start').add(new Option(hh(h),h));
$('#start').value=String(Math.min(initialHour,18));
$('#today-label').textContent=new Intl.DateTimeFormat('es-ES',{dateStyle:'long',timeZone:'Europe/Madrid'}).format(new Date());
$('#hour-labels').innerHTML=Array.from({length:7},(_,i)=>'<span>'+String(i*2+8).padStart(2,'0')+':00</span>').join('');
let query={date:selectedDay,start:Number($('#start').value),duration:2};
try{const state=JSON.parse(sessionStorage.getItem('cabinas-uji.view')||'null');if(state){if(['all','1','2','3','5'].includes(state.floor))floor=state.floor;if(Number.isInteger(state.selected))selected=state.selected;}}catch{}
function remember(){try{sessionStorage.setItem('cabinas-uji.view',JSON.stringify({floor,selected}));sessionStorage.setItem('cabinas-uji.bookingDraft',JSON.stringify({room:selected,...query}));}catch{}}
function syncToday(){
  const currentDay=dayString();if(currentDay===today)return false;
  today=currentDay;$('#date').min=today;$('#date').max=addDays(today,30);
  $('#today-label').textContent=new Intl.DateTimeFormat('es-ES',{dateStyle:'long',timeZone:'Europe/Madrid'}).format(new Date());
  if(query.date<today){query={...query,date:today};if(!$('#date').value||$('#date').value<today)$('#date').value=today;}
  generation++;data={};updatedAt=null;failed=0;loading=false;calendarNeedsReload=true;nowMode=false;
  remember();return true;
}
function currentCalendar(r){
  const d=data[r.id];if(!d||d.error||!Array.isArray(d.events))return null;
  const fetched=Date.parse(d.fetchedAt),age=Date.now()-fetched;
  return Number.isFinite(fetched)&&age>=-60000&&age<CALENDAR_MAX_AGE?d:null;
}
function roomState(r){
  if(r.kind==='open')return 'open';const d=currentCalendar(r);if(!d)return 'unknown';
  const now=parts();if(query.start+query.duration>20||query.start<8||query.date===today&&query.start<Number(now.hour)+Number(now.minute)/60)return 'closed';
  return d.events.some(e=>e.start<query.start+query.duration&&e.end>query.start)?'busy':'free';
}
function windows(r){const d=currentCalendar(r);if(!d||r.kind==='open')return [];const a=[];let start=null;for(let i=0;i<=24;i++){const h=8+i/2,available=i<24&&!d.events.some(e=>e.start<h+.5&&e.end>h);if(available&&start===null)start=h;if(!available&&start!==null){a.push({start,end:h});start=null}}return a;}
function stateText(r){return {free:'Libre en tu franja',busy:'No disponible',unknown:!data[r.id]&&loading?'Consultando…':'Sin confirmar',closed:'Fuera de horario',open:'Acceso directo'}[roomState(r)]}
function pill(r){const s=roomState(r);return '<span class="pill '+(['busy','closed'].includes(s)?'busy':['unknown','open'].includes(s)?'unknown':'')+'">'+stateText(r)+'</span>';}
function timeline(r){let t='';const d=currentCalendar(r);for(let i=0;i<24;i++){const h=8+i*.5;let classes='slot',reason='Libre para reservar';if(!d||r.kind==='open'){classes+=' unknown';reason=r.kind==='open'?'Ocupación no publicada':'Sin disponibilidad verificada'}else{const e=d.events.find(e=>e.start<h+.5&&e.end>h);if(e){classes+=e.type==='closed'?' closed':' busy';reason=e.type==='closed'?'Cerrada':'No disponible'}}if(h<query.start+query.duration&&h+.5>query.start)classes+=' inrange';t+='<span class="'+classes+'" title="'+hh(h)+'–'+hh(h+.5)+': '+reason+'" aria-hidden="true"></span>'}return '<div class="timeline">'+t+'</div>';}
function filtered(){
  const term=$('#room-search').value.trim(),onlyFree=$('#only-free').checked;
  return rooms.filter(r=>(floor==='all'||r.floor===Number(floor))&&(!term||String(r.id).includes(term)))
    .map(room=>({room,rank:room.bookingSupported?(roomState(room)==='free'?0:1):room.kind==='open'?2:3}))
    .filter(({rank})=>!onlyFree||rank===0)
    .sort((a,b)=>a.rank-b.rank||a.room.id-b.room.id).map(({room})=>room);
}
function empty(){return '<div class="empty">'+icon('grid')+'<strong>No encontramos esa cabina.</strong><p>Prueba con otro número o cambia de planta.</p><button type="button" data-reset-filters>Quitar filtros</button></div>';}
function render(){
  const focusedRoom=document.activeElement?.dataset?.room,focusedView=document.activeElement?.classList?.contains('room-card')?'#cards':'#rows';
  const known=rooms.filter(r=>r.kind==='bookable'&&(floor==='all'||r.floor===Number(floor))&&currentCalendar(r)),current=rooms.filter(r=>r.bookingSupported&&(floor==='all'||r.floor===Number(floor)));
  if(!known.length)$('#only-free').checked=false;const list=filtered();
  $('#result-count').textContent=list.length;$('#range-label').textContent='Tu franja: '+shortDate(query.date)+' · '+hh(query.start)+'–'+hh(query.start+query.duration);
  $('#rows').innerHTML=list.map(r=>'<button type="button" class="room-row '+(r.id===selected?'selected':'')+'" data-room="'+r.id+'" aria-pressed="'+(r.id===selected)+'" aria-label="Cabina '+r.id+', planta '+r.floor+'. '+stateText(r)+'"><span><span class="room-name">Cabina '+r.id+'</span><span class="room-floor">'+icon('layers')+'Planta '+r.floor+'</span></span>'+timeline(r)+'<span class="row-status">'+pill(r)+'<small>'+(r.kind==='open'?'Sin reserva':r.bookingSupported===false?'Ver referencia':'Ver detalle ↗')+'</small></span></button>').join('')||empty();
  $('#cards').innerHTML=list.map(r=>'<button type="button" class="room-card '+(r.id===selected?'selected':'')+'" data-room="'+r.id+'" aria-pressed="'+(r.id===selected)+'" aria-label="Ver cabina '+r.id+', planta '+r.floor+'. '+stateText(r)+'"><span class="card-top"><span class="card-title"><span class="room-number" aria-hidden="true">'+r.id+'</span><span><span class="room-name">Cabina '+r.id+'</span><span class="room-floor">Planta '+r.floor+'</span></span></span>'+pill(r)+'</span>'+timeline(r)+'<span class="timeline-labels"><span>08:00</span><span>14:00</span><span>20:00</span></span><span class="card-footer"><span>'+(r.kind==='open'?'Acceso sin reserva':r.bookingSupported===false?'Referencia de listado':'Reserva con cuenta UJI')+'</span><span class="card-action">Ver cabina '+icon('arrow')+'</span></span></button>').join('')||empty();
  $('#free-count').textContent=known.length?known.filter(r=>roomState(r)==='free').length+' libres':loading?'Consultando':'Sin verificar';
  $('#free-desc').textContent=known.length?'De '+known.length+' calendarios consultables':loading?'Consultando tu sesión local':'Abre el horario oficial de la UJI';
  $('#availability-stat').classList.toggle('unverified',!known.length);$('#availability-symbol').innerHTML=icon(known.length?'check':'help');
  $('#legend-free').hidden=!known.length;$('#legend-busy').hidden=!known.length;
  $('#total-count').innerHTML=current.length+' <small>cabinas</small>';$('#total-desc').textContent=floor==='all'?'En el catálogo actual de la UJI':'Con reserva en la planta '+floor;
  $('#session-duration').innerHTML=(query.duration===.5?'30 <small>minutos</small>':query.duration+' <small>'+ (query.duration===1?'hora':'horas')+'</small>');
  $('#session-time').textContent=shortDate(query.date)+' · '+hh(query.start)+'–'+hh(query.start+query.duration);
  $('#only-free').disabled=!known.length;$('#only-free-label').title=known.length?'Mostrar las cabinas con disponibilidad comprobable':'Se activará cuando haya horarios confirmados';
  $$('[data-floor]').forEach(b=>{b.classList.toggle('active',b.dataset.floor===floor);b.setAttribute('aria-pressed',b.dataset.floor===floor)});
  renderDetail();quickStyle();status();notice();
  if(focusedRoom)$(focusedView+' [data-room="'+Number(focusedRoom)+'"]')?.focus({preventScroll:true});
}
function notice(){
  const restricted=Object.values(data).some(d=>d.reason==='access_required'),weekend=[0,6].includes(new Date(query.date+'T12:00:00Z').getUTCDay()),now=parts();let title='',note='',link=false;
  if(query.start+query.duration>20){title='Tu sesión termina después de las 20:00.';note='Prueba una hora anterior o una duración menor.'}
  else if(query.date===today&&query.start<Number(now.hour)+Number(now.minute)/60){title='Esta hora ya ha pasado.';note='Elige una hora futura o consulta otro día.'}
  else if(restricted){title='No tenemos las horas libres verificadas.';note='La consulta pública devuelve un bloqueo general. Pulsa «Conectar con UJI» para consultar los horarios con tu sesión local.';link=true}
  else if(weekend){title='Has elegido un fin de semana.';note='Comprueba la apertura y las condiciones de reserva en la biblioteca.'}
  else if(failed&&failed===rooms.filter(r=>r.bookingSupported).length){title='No hemos podido comprobar los horarios.';note='Puedes consultar el calendario oficial o volver a actualizar.';link=true}
  else if(!loading&&!rooms.some(r=>currentCalendar(r))){title='Disponibilidad sin verificar.';note='Elegir una hora aquí no confirma que haya una cabina libre. Compruébalo en el horario oficial.';link=true}
  $('#notice').hidden=!title;$('#notice').innerHTML=title?icon('help')+'<div><strong>'+title+'</strong> '+note+'</div>'+(link?'<a href="https://sites.google.com/uji.es/disponibilitat-cabines/p%C3%A0gina-principal" target="_blank" rel="noopener">Consultar horario UJI ↗</a>':''):'';
}
function renderDetail(){
  const r=rooms.find(r=>r.id===selected);if(!r)return;const w=windows(r),bookable=r.kind==='bookable'&&r.bookingSupported!==false;
  let info=r.kind==='open'?'De acceso directo durante la apertura de la biblioteca. Comprueba si hay sitio al llegar.':!data[r.id]&&loading?'Estamos consultando el calendario oficial…':data[r.id]?.error?data[r.id].reason==='access_required'?'El horario actual requiere acceso UJI. Abre el calendario oficial para comprobar las horas libres.':'No hay horarios confirmados para esta cabina. Comprueba su disponibilidad en la UJI.':!currentCalendar(r)?'Sin disponibilidad verificada. Consulta el horario oficial de la UJI.':'';
  $('#selection').innerHTML='<div class="detail-identity"><span class="detail-number" aria-hidden="true">'+r.id+'</span><div><h3>Cabina '+r.id+'</h3><span class="room-floor">'+icon('layers')+'Planta '+r.floor+' · Biblioteca UJI</span></div></div><div class="detail-status">'+pill(r)+'<span>'+(r.kind==='open'?'Sin reserva previa':'Horario de reserva')+'</span></div><div class="session-box"><span class="session-label">Franja que quieres consultar</span><span>'+icon('calendar')+esc(longDate(query.date))+'</span><span>'+icon('clock')+hh(query.start)+'–'+hh(query.start+query.duration)+' · '+(query.duration===.5?'30 min':query.duration+' h')+'</span></div>'+(info?'<p class="detail-info">'+info+'</p>':'')+(r.kind==='bookable'&&currentCalendar(r)?'<p class="detail-info">Bloqueos oficiales: '+(currentCalendar(r).events.filter(e=>e.type==='unavailable'&&e.start<20&&e.end>8).map(e=>hh(Math.max(8,e.start))+'–'+hh(Math.min(20,e.end))).join(', ')||'ninguno entre las 08:00 y las 20:00')+'</p><p class="window-title">HUECOS EN BLOQUES DE 30 MINUTOS</p><div class="windows">'+(w.length?w.map(x=>'<button class="window" data-window="'+x.start+'" title="Buscar desde las '+hh(x.start)+'">'+hh(x.start)+'–'+hh(x.end)+'</button>').join(''):'<span class="loading-note">Sin huecos de 30 minutos este día.</span>')+'</div>':'')+(bookable?'<button type="button" class="booking-trigger" data-book-room="'+r.id+'">'+icon('users')+'Continuar reserva en UJI '+icon('arrow')+'</button><p class="booking-caption">Opcional · Elige también las horas y confirma en la web oficial.</p>':r.kind==='bookable'?'<div class="detail-old">Esta referencia procede de un listado anterior y no aparece entre las fichas actuales de reserva.</div>':'')+'<a class="availability-link" href="'+(r.kind==='open'?'https://www.uji.es/serveis/cd/bib/serveis/cabines/':r.url)+'" target="_blank" rel="noopener">'+(r.kind==='open'?'Condiciones de acceso':'Consultar horario UJI')+icon('external')+'</a><a class="plan-link" href="'+planUrls[r.floor]+'" target="_blank" rel="noopener">'+icon('layers')+'Ver plano de la planta '+r.floor+' ↗</a>';
  if(mode==='floor')floorMap(r);
}
function floorMap(r){$('#map-frame').innerHTML='<div class="map-floor">'+icon('layers')+'<strong>Planta '+r.floor+'</strong><p>Cabina '+r.id+' · Busca su número en el plano y en la señalización de la planta.</p><a href="'+planUrls[r.floor]+'" target="_blank" rel="noopener">Abrir plano oficial ↗</a></div>';}
function status(){
  const total=rooms.filter(r=>r.bookingSupported).length,done=rooms.filter(r=>r.bookingSupported&&data[r.id]).length,restricted=Object.values(data).some(d=>d.reason==='access_required');
  $('#connection-dot').className='dot '+(loading?'loading':failed?'error':'');
  $('#connection-text').textContent=loading?'Consultando horarios · '+done+' de '+total:restricted?'Sin franjas verificadas · Conecta tu sesión UJI para consultar horarios':failed?'Consulta parcial · '+failed+' calendarios sin datos':!rooms.some(r=>currentCalendar(r))?'Datos sin verificar · Consulta el horario UJI':'Actualizado '+(updatedAt?new Intl.DateTimeFormat('es-ES',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Madrid'}).format(new Date(updatedAt)):'ahora')+' · Calendario oficial UJI';
  $('#refresh').disabled=loading;
}
function quickStyle(){$('#date-display').textContent=new Intl.DateTimeFormat('es-ES',{weekday:'short',day:'numeric',month:'short',timeZone:'Europe/Madrid'}).format(new Date(query.date+'T12:00:00Z'));$('#today-btn').classList.toggle('on',query.date===today);$('#tomorrow-btn').classList.toggle('on',query.date===addDays(today,1));$('#now-btn').classList.toggle('on',nowMode)}
async function load(){
  syncToday();calendarNeedsReload=false;lastLoadAt=Date.now();
  const gen=++generation;loading=true;failed=0;
  if(personalConnector?.enabled&&lastLoadDate===query.date){
    data=Object.fromEntries(rooms.filter(r=>currentCalendar(r)).map(r=>[r.id,data[r.id]]));
  }else{data={};updatedAt=null;}
  lastLoadDate=query.date;render();
  if(personalConnector?.enabled){await personalConnector.load(query.date,gen);return;}
  const date=query.date,ids=rooms.filter(r=>r.kind==='bookable').map(r=>r.id),chunks=[];for(let i=0;i<ids.length;i+=4)chunks.push(ids.slice(i,i+4));let cursor=0;
  async function run(){while(cursor<chunks.length){const chunk=chunks[cursor++];try{const response=await fetch('/api/availability?date='+date+'&ids='+chunk.join(','),{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error('Upstream');const result=await response.json();if(gen!==generation)return;for(const r of result.rooms){data[r.id]=r;if(r.error)failed++}updatedAt=result.updatedAt}catch{if(gen!==generation)return;chunk.forEach(id=>{data[id]={error:true};failed++})}render()}}
  await Promise.all([run(),run()]);if(gen!==generation)return;loading=false;render();
}
function apply(refresh=false){
  syncToday();nowMode=false;const date=$('#date').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<today||date>addDays(today,30))return;
  const changed=date!==query.date||calendarNeedsReload;
  query={date,start:Number($('#start').value),duration:Number($('#duration').value)};
  const usingUji=personalConnector?.enabled;
  if(refresh===true&&personalConnector?.native)personalConnector.enabled=true;
  remember();
  if(changed||(refresh===true&&personalConnector?.enabled&&(!loading||!usingUji)))load();else render();
}
function checkFreshness({resume=false}={}){
  if($('#booking-dialog')?.open)return;
  const changed=syncToday();if(!rooms.length)return;
  const age=Date.now()-lastLoadAt,hadPublicData=Object.values(data).some(d=>d&&!d.error);
  if(changed||calendarNeedsReload||(!loading&&age>=CALENDAR_MAX_AGE&&(resume||hadPublicData))){load();return;}
  render();
}
function setView(next){view=next;$$('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-pressed',b.dataset.view===view)});$('#schedule-view').hidden=view!=='schedule';$('#cards-view').hidden=view!=='cards';}
const roomDialog=$('#room-dialog'),detailPanel=$('#detail-panel');
function closeRoom(){if(roomDialog.open)roomDialog.close();}
function showRoom(){if(matchMedia('(max-width:760px)').matches){$('#room-dialog-content').append(detailPanel);roomDialog.showModal();document.documentElement.classList.add('room-open');}else $('#detail-panel').animate([{boxShadow:'0 0 0 3px #9db78270'},{boxShadow:'0 0 0 0px #9db78200'}],{duration:650});}
roomDialog.addEventListener('close',()=>{document.documentElement.classList.remove('room-open');$('#selection-home').append(detailPanel);});
$('#room-close').onclick=closeRoom;
roomDialog.addEventListener('click',e=>{if(e.target===roomDialog){const b=roomDialog.getBoundingClientRect();if(e.clientY<b.top||e.clientY>b.bottom||e.clientX<b.left||e.clientX>b.right)closeRoom();}});
matchMedia('(max-width:760px)').addEventListener('change',e=>{if(!e.matches)closeRoom();setView(e.matches?'cards':'schedule')});
$('#filters').addEventListener('submit',e=>{e.preventDefault();apply(true);$('#availability-panel').scrollIntoView({behavior:'smooth',block:'start'})});
['date','start','duration'].forEach(id=>$('#'+id).addEventListener('change',apply));$('#only-free').addEventListener('change',render);$('#room-search').addEventListener('input',render);$('#refresh').addEventListener('click',()=>apply(true));
$('#today-btn').onclick=()=>{syncToday();$('#date').value=today;$('#start').value='8';apply()};
$('#tomorrow-btn').onclick=()=>{syncToday();$('#date').value=addDays(today,1);$('#start').value='8';apply()};
$('#now-btn').onclick=()=>{syncToday();const p=parts();$('#date').value=today;$('#start').value=String(Math.max(8,Math.min(19.5,Math.ceil((Number(p.hour)+Number(p.minute)/60)*2)/2)));apply();nowMode=true;quickStyle()};
$$('[data-floor]').forEach(b=>b.onclick=()=>{floor=b.dataset.floor;const list=filtered();if(list.length&&!list.some(r=>r.id===selected))selected=list[0].id;remember();render()});
$$('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.addEventListener('click',e=>{const row=e.target.closest('[data-room]');if(row){selected=Number(row.dataset.room);remember();render();showRoom()}const win=e.target.closest('[data-window]');if(win){$('#start').value=String(win.dataset.window);apply()}if(e.target.closest('[data-reset-filters]')){floor='all';$('#room-search').value='';$('#only-free').checked=false;remember();render()}if(e.target.closest('[data-book-room]'))closeRoom();});
$('#map-campus').onclick=()=>{mode='campus';$('#map-campus').classList.add('active');$('#map-floor').classList.remove('active');$('#map-campus').setAttribute('aria-pressed','true');$('#map-floor').setAttribute('aria-pressed','false');$('#map-frame').innerHTML='<iframe title="Ubicación de la Biblioteca UJI en Google Maps" src="https://maps.google.com/maps?q=Biblioteca+Universitat+Jaume+I+Castello&z=17&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>'};
$('#map-floor').onclick=()=>{mode='floor';$('#map-floor').classList.add('active');$('#map-campus').classList.remove('active');$('#map-floor').setAttribute('aria-pressed','true');$('#map-campus').setAttribute('aria-pressed','false');const r=rooms.find(r=>r.id===selected);if(r)floorMap(r)};
['#help-top','#sources'].forEach(s=>$(s).onclick=()=>$('#help-dialog').showModal());$('#help-dialog .close').onclick=()=>$('#help-dialog').close();
$('#help-dialog').addEventListener('click',e=>{if(e.target===$('#help-dialog')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close()}});
setView(view);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkFreshness({resume:true})});
window.addEventListener('focus',()=>checkFreshness({resume:true}));
window.addEventListener('pageshow',()=>checkFreshness({resume:true}));
setInterval(()=>{if(document.visibilityState==='visible')checkFreshness()},30000);
async function init(){try{const r=await fetch('/api/rooms');if(!r.ok)throw Error();rooms=await r.json();if(!rooms.some(r=>r.id===selected))selected=207;render();await load()}catch{loading=false;$('#free-count').textContent='Sin conexión';$('#free-desc').textContent='No se pudo cargar el listado';$('#rows').innerHTML='<div class="empty"><strong>No se han podido cargar las cabinas.</strong><p>Vuelve a intentarlo en unos instantes.</p></div>';$('#cards').innerHTML=$('#rows').innerHTML;$('#connection-dot').className='dot error';$('#connection-text').textContent='No se ha podido conectar. Pulsa actualizar para reintentar.';$('#refresh').disabled=false;$('#refresh').onclick=()=>location.reload()}}
init();

(()=>{const origin=location.origin;let resetting=false;window.cabinasDesktop.onMessage(m=>{if(m.type==='session_reset'){resetting=m.phase!=='complete';personalConnector?.resetLocal();generation++;loading=false;data={};updatedAt=null;failed=0;render();$('#connector-connect').disabled=resetting;$('#connector-message').textContent=m.phase==='started'?'Cerrando la sesión local…':m.phase==='complete'?'Sesión local cerrada.':'No se ha podido borrar completamente la sesión. Pulsa Cerrar sesión local para reintentarlo.';return;}if(!resetting)window.postMessage(m,origin);});window.addEventListener('message',e=>{if(!resetting&&e.source===window&&e.origin===origin&&e.data?.channel==='cabinas-uji-web'&&['ping','connect','cancel'].includes(e.data.type))window.cabinasDesktop.send(e.data);});})();
// The bridge lives only in this browser. Never POST personalized context or
// results to the server. The extension supplies normalized numeric intervals.
(()=>{
  const origin=location.origin;
  const native=Boolean(window.cabinasDesktop),sessionKey='cabinas-uji.auto-check';
  let installed=false,pending=null,finishLoad=null,timer=null,remembered=false;
  try{remembered=native&&localStorage.getItem(sessionKey)==='1';}catch{}
  const message=text=>{$('#connector-message').textContent=text};
  const send=(type,extra={})=>window.postMessage({channel:'cabinas-uji-web',type,...extra},origin);
  function updateSessionView(){
    if(!native)return;
    $('.connector-panel').classList.toggle('session-connected',remembered);
    $('#connector-connect').hidden=remembered;
    $('#account-label').textContent=remembered?'Mi cuenta':'Cuenta UJI';
    $('.account-optional').hidden=remembered;
  }
  function rememberSession(value){
    if(!native||remembered===value)return;
    remembered=value;
    try{if(value)localStorage.setItem(sessionKey,'1');else localStorage.removeItem(sessionKey);}catch{}
    updateSessionView();
  }
  const errors={unverified:'UJI sigue devolviendo el bloqueo general. No hemos podido verificar las horas libres.',connection:'No se ha podido consultar con esta sesión. Puedes volver a conectar.',calendar_missing:'El formulario UJI no muestra un calendario consultable. No hay horarios verificados.',page_changed:'El catálogo ha cambiado y el recorrido automático no ha encontrado el formulario.',timeout:'La conexión ha caducado. Pulsa Conectar con UJI para intentarlo de nuevo.',extension_unavailable:'La conexión local no responde. Comprueba que esté activa y recarga esta página.'};
  Object.assign(errors,{catalogue_permission:'Chrome no permite al conector acceder al catálogo UJI. Comprueba su permiso para cataleg.uji.es en los detalles de la extensión.',navigation_changed:'La página UJI cambió durante la consulta. Puedes volver a conectar.',reader_failed:'El conector no ha podido leer el calendario UJI. No hay horarios verificados.'});
  function end(){clearTimeout(timer);pending=null;$('#connector-cancel').hidden=true;$('#connector-connect').disabled=false;const done=finishLoad;finishLoad=null;done?.();}
  function cancel(){if(pending)send('cancel',{requestId:pending.id});personalConnector.enabled=false;end();generation++;loading=false;data={};updatedAt=null;failed=0;render();message('Conexión detenida. Los horarios quedan sin confirmar.');}
  function acceptRoom(item){
    if(!item||!rooms.some(r=>r.id===item.id&&r.bookingSupported)||!pending||pending.date!==query.date)return;
    const bad=()=>{data[item.id]={id:item.id,error:true,reason:'calendar_unverified',events:[]};failed++};
    if(item.error){bad();return;}
    const age=Date.now()-Date.parse(item.fetchedAt);
    if(!Number.isFinite(age)||age< -60000||age>=CALENDAR_MAX_AGE||!Array.isArray(item.events)||item.events.length>1000||item.events.some(e=>!Number.isFinite(e.start)||!Number.isFinite(e.end)||e.start<0||e.end>24||e.end<e.start||!['closed','unavailable'].includes(e.type))){bad();return;}
    data[item.id]={id:item.id,fetchedAt:item.fetchedAt,events:item.events.map(e=>({start:e.start,end:e.end,type:e.type}))};updatedAt=item.fetchedAt;
    rememberSession(true);
  }
  personalConnector={enabled:remembered,native,resetLocal(){rememberSession(false);cancel()},load(date,gen){
    if(pending)send('cancel',{requestId:pending.id});end();
    return new Promise(resolve=>{
      const id=crypto.randomUUID();pending={id,date,gen};finishLoad=resolve;
      $('#connector-connect').disabled=true;$('#connector-cancel').hidden=false;message('Abriendo la consulta UJI automáticamente…');
      send('connect',{requestId:id,date});
      timer=setTimeout(()=>{if(!pending||pending.id!==id)return;send('cancel',{requestId:id});personalConnector.enabled=remembered;loading=false;render();end();message(errors.timeout)},905000);
    });
  }};
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==origin||event.data?.channel!=='cabinas-uji-extension')return;
    const m=event.data;
    if(m.type==='ready'&&m.version>=2){installed=true;if(!pending)message(remembered?'Consultas UJI activadas.':'Lista para conectar. Pulsa Conectar con UJI; solo tendrás que identificarte si UJI lo pide.');return;}
    if(!pending||m.requestId!==pending.id||m.date!==pending.date||pending.gen!==generation)return;
    if(m.type==='opening')message('Abriendo el catálogo UJI…');
    if(m.type==='login')message('UJI necesita identificarte. Completa el acceso en su ventana; la consulta continuará al volver al catálogo.');
    if(m.type==='reading')message('Consultando las cabinas con tu sesión UJI…');
    if(m.type==='progress'){acceptRoom(m.room);render();message('Consultando cabinas · '+Math.min(39,Math.max(0,Number(m.done)||0))+' de 39');}
    if(['done','error','cancelled'].includes(m.type)){
      const known=rooms.filter(r=>currentCalendar(r)).length;
      loading=false;if(m.type!=='done')personalConnector.enabled=m.type==='error'&&remembered;render();end();
      message((m.type==='done'?(known?known+' cabinas verificadas para este día. Se actualizarán desde tu sesión mientras la conexión esté activa.':'La consulta ha terminado sin horarios verificables.'):m.type==='cancelled'?'Conexión cancelada.':errors[m.code]||'No se ha completado la conexión. Las cabinas pendientes siguen sin confirmar.')+(m.type==='error'&&m.tabKept?' La ventana UJI permanece abierta para comprobar el problema.':''));
    }
  });
  $('#connector-connect').addEventListener('click',()=>{
    if(!installed){$('#connector-help').open=true;message('No ha arrancado la conexión local. Cierra y vuelve a abrir la aplicación.');send('ping');return;}
    personalConnector.enabled=true;load();
  });
  $('#connector-cancel').addEventListener('click',cancel);
  window.addEventListener('pagehide',()=>{if(pending)send('cancel',{requestId:pending.id})});
  updateSessionView();
  send('ping');
})();

// The official catalogue owns authentication, session cookies and submission.
// Never read the cross-origin frame, collect credentials or infer authentication
// from an iframe load, a popup closing, or a visitor clicking a button.
const BOOKING_ORIGIN='https://cataleg.uji.es';
const BOOKING_VID='34CVA_UJI:VU1';
const bookingDialog=$('#booking-dialog');
const bookingFrame=$('#booking-frame');
let bookingRoom=null,bookingSection='room',bookingLoadingTimer=null;

function catalogueUrl(section,room){
  const url=new URL(section==='account'?'/discovery/account':'/discovery/fulldisplay',BOOKING_ORIGIN);
  if(section!=='account'){
    if(!room||room.kind!=='bookable'||room.bookingSupported===false||!/^\d{1,19}$/.test(String(room.mms)))throw Error('Selecciona una cabina con reserva.');
    url.searchParams.set('docid','alma'+room.mms);url.searchParams.set('context','L');
  }
  url.searchParams.set('vid',BOOKING_VID);url.searchParams.set('lang','es');
  return url.href;
}
function updateBookingContext(){
  const context=$('#booking-context');context.replaceChildren();
  const strong=document.createElement('strong');strong.textContent=bookingSection==='account'?'Tu cuenta en la biblioteca':'Cabina '+bookingRoom.id+' · Planta '+bookingRoom.floor;context.append(strong);
  if(bookingSection==='room'){
    const date=document.createElement('span');date.innerHTML=icon('calendar');date.append(query.date.split('-').reverse().join('/'));context.append(date);
    const time=document.createElement('span');time.innerHTML=icon('clock');time.append(hh(query.start)+'–'+hh(query.start+query.duration));context.append(time);
    const note=document.createElement('small');note.textContent='Franja deseada. Selecciona también estas horas en el formulario oficial; la reserva solo queda confirmada cuando la UJI la acepta.';context.append(note);
  }else{const note=document.createElement('small');note.textContent='Consulta y gestiona tus solicitudes en el catálogo oficial.';context.append(note);}
  $('#booking-tab-room').classList.toggle('active',bookingSection==='room');$('#booking-tab-room').setAttribute('aria-pressed',String(bookingSection==='room'));
  $('#booking-tab-account').classList.toggle('active',bookingSection==='account');$('#booking-tab-account').setAttribute('aria-pressed',String(bookingSection==='account'));
  $('#booking-tab-room').disabled=!bookingRoom;
  $('#booking-signin-label').textContent=bookingSection==='account'?'Entrar a mi cuenta UJI':'Entrar y reservar en UJI';
}
function loadBookingFrame(){
  const url=catalogueUrl(bookingSection,bookingRoom);
  clearTimeout(bookingLoadingTimer);
  $('#booking-external').href=url;
  $('#booking-signin').href=url;
  if(!$('#booking-preview-details').open){bookingFrame.removeAttribute('src');return;}
  $('#booking-loader').hidden=false;
  // A new URL assignment reloads the official page with its own cookies. There
  // is no proxy, token transfer, form interception or local reservation POST.
  bookingFrame.src=url;
  bookingLoadingTimer=setTimeout(()=>{$('#booking-loader').hidden=true;},12000);
}
function openBooking(roomId,section='room'){
  checkFreshness({resume:true});
  bookingRoom=rooms.find(r=>r.id===Number(roomId)&&r.kind==='bookable'&&r.bookingSupported!==false)||rooms.find(r=>r.id===selected&&r.kind==='bookable'&&r.bookingSupported!==false)||null;
  if(section==='room'&&!bookingRoom)return;
  bookingSection=section;$('#booking-preview-details').open=false;updateBookingContext();$('#booking-popup-note').classList.remove('visible');
  try{sessionStorage.setItem('cabinas-uji.bookingDraft',JSON.stringify({room:bookingRoom?.id,date:query.date,start:query.start,duration:query.duration}));}catch{}
  if(!bookingDialog.open){bookingDialog.showModal();document.documentElement.classList.add('booking-open');}
  loadBookingFrame();
}
bookingFrame.addEventListener('load',()=>{clearTimeout(bookingLoadingTimer);$('#booking-loader').hidden=true;});
bookingDialog.addEventListener('close',()=>{clearTimeout(bookingLoadingTimer);document.documentElement.classList.remove('booking-open');bookingFrame.removeAttribute('src');});
$('#booking-close').addEventListener('click',()=>bookingDialog.close());
$('#booking-browse').addEventListener('click',()=>bookingDialog.close());
bookingDialog.addEventListener('click',e=>{if(e.target===bookingDialog){const bounds=bookingDialog.getBoundingClientRect();if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)bookingDialog.close();}});
$('#booking-account').addEventListener('click',()=>openBooking(selected,'account'));
document.addEventListener('click',e=>{const button=e.target.closest('[data-book-room]');if(button)openBooking(button.dataset.bookRoom);});
$('#booking-tab-room').addEventListener('click',()=>{if(!bookingRoom)return;bookingSection='room';updateBookingContext();loadBookingFrame();});
$('#booking-tab-account').addEventListener('click',()=>{bookingSection='account';updateBookingContext();loadBookingFrame();});
$('#booking-reload').addEventListener('click',loadBookingFrame);
$('#booking-preview-details').addEventListener('toggle',()=>{if(bookingDialog.open)loadBookingFrame();});
$('#booking-signin').addEventListener('click',()=>{$('#booking-popup-note').classList.add('visible');});

// Keep the non-sensitive room/time preference when returning from official SSO.
// This preference is never interpreted as a reservation or an authenticated user.
try{
  const draft=JSON.parse(sessionStorage.getItem('cabinas-uji.bookingDraft')||'null');
  if(draft&&Number.isInteger(draft.room)&&/^\d{4}-\d{2}-\d{2}$/.test(draft.date)&&draft.date>=today&&draft.date<=addDays(today,30)&&Number.isInteger(draft.start*2)&&draft.start>=8&&draft.start<20&&[.5,1,2,3,4,5,6].includes(draft.duration)){
    selected=draft.room;query={date:draft.date,start:draft.start,duration:draft.duration};
    $('#date').value=query.date;$('#start').value=String(query.start);$('#duration').value=String(query.duration);
  }
}catch{}

document.querySelector('#local-signout').addEventListener('click',()=>window.cabinasDesktop.send({type:'disconnect'}));