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
