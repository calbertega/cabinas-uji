// The bridge lives only in this browser. Never POST personalized context or
// results to the server. The extension supplies normalized numeric intervals.
(()=>{
  const origin=location.origin;
  let installed=false,pending=null,finishLoad=null,timer=null;
  const message=text=>{$('#connector-message').textContent=text};
  const send=(type,extra={})=>window.postMessage({channel:'cabinas-uji-web',type,...extra},origin);
  const errors={unverified:'UJI sigue devolviendo el bloqueo general. No hemos podido verificar las horas libres.',connection:'No se ha podido consultar con esta sesión. Puedes volver a conectar.',calendar_missing:'El formulario UJI no muestra un calendario consultable. No hay horarios verificados.',page_changed:'El catálogo ha cambiado y el recorrido automático no ha encontrado el formulario.',timeout:'La conexión ha caducado. Pulsa Conectar con UJI para intentarlo de nuevo.',extension_unavailable:'La extensión no responde. Comprueba que esté activa y recarga esta página.'};
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
  }
  personalConnector={enabled:false,load(date,gen){
    if(pending)send('cancel',{requestId:pending.id});end();
    return new Promise(resolve=>{
      const id=crypto.randomUUID();pending={id,date,gen};finishLoad=resolve;
      $('#connector-connect').disabled=true;$('#connector-cancel').hidden=false;message('Abriendo la consulta UJI automáticamente…');
      send('connect',{requestId:id,date});
      timer=setTimeout(()=>{if(!pending||pending.id!==id)return;send('cancel',{requestId:id});personalConnector.enabled=false;loading=false;render();end();message(errors.timeout)},305000);
    });
  }};
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==origin||event.data?.channel!=='cabinas-uji-extension')return;
    const m=event.data;
    if(m.type==='ready'&&m.version>=2){installed=true;if(!pending)message('Extensión detectada. Pulsa Conectar con UJI: abriremos el calendario por ti.');return;}
    if(!pending||m.requestId!==pending.id||m.date!==pending.date||pending.gen!==generation)return;
    if(m.type==='opening')message('Abriendo el catálogo UJI…');
    if(m.type==='login')message('UJI necesita identificarte. Completa el acceso en su ventana; la consulta continuará al volver al catálogo.');
    if(m.type==='reading')message('Consultando las cabinas con tu sesión UJI…');
    if(m.type==='progress'){acceptRoom(m.room);render();message('Consultando cabinas · '+Math.min(39,Math.max(0,Number(m.done)||0))+' de 39');}
    if(['done','error','cancelled'].includes(m.type)){
      const known=rooms.filter(r=>currentCalendar(r)).length;
      loading=false;if(m.type!=='done')personalConnector.enabled=false;render();end();
      message((m.type==='done'?(known?known+' cabinas verificadas para este día. Se actualizarán desde tu sesión mientras la conexión esté activa.':'La consulta ha terminado sin horarios verificables.'):m.type==='cancelled'?'Conexión cancelada.':errors[m.code]||'No se ha completado la conexión. Las cabinas pendientes siguen sin confirmar.')+(m.type==='error'&&m.tabKept?' La pestaña UJI permanece abierta para comprobar el problema.':''));
    }
  });
  $('#connector-connect').addEventListener('click',()=>{
    if(!installed){$('#connector-help').open=true;message('No detectamos el conector 0.2. Descárgalo en «Acerca de la extensión», cárgalo en este navegador y recarga esta página.');send('ping');return;}
    personalConnector.enabled=true;load();
  });
  $('#connector-cancel').addEventListener('click',cancel);
  window.addEventListener('pagehide',()=>{if(pending)send('cancel',{requestId:pending.id})});
  send('ping');
})();
