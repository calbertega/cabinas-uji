// Open only the request form, never its submission controls. Account contents
// and the personalized calendar URL never leave the catalogue browsing context.
async function advanceUjiCalendar(allowSignIn=true){
  if(location.origin!=='https://cataleg.uji.es'||!location.pathname.startsWith('/discovery/'))return {stage:'login'};
  const visible=e=>!!(e.getClientRects().length)&&!e.disabled&&e.getAttribute('type')!=='submit'&&!(e.tagName==='BUTTON'&&e.type==='submit');
  const controls=()=>[...document.querySelectorAll('button,a')].filter(visible);
  const label=e=>(e.textContent||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim();
  const ready=()=>[...document.querySelectorAll('iframe[src],a[href]')].some(e=>{try{const u=new URL(e.getAttribute('src')||e.getAttribute('href'),location.href);return u.origin===location.origin&&['/view/uresolver/34CVA_UJI/bookingAvailability','/view/calendar/Calendar.html'].includes(u.pathname)&&/^\d{1,19}$/.test(u.searchParams.get('userId')||u.searchParams.get('pageBean.userId')||'')}catch{return false}});
  let clicked=false,signin=false;
  for(let i=0;i<40;i++){
    if(ready())return {stage:'ready'};
    const list=controls();
    const provider=list.find(e=>/^(Usuario UJI|Usuari UJI)(\s+NO_DEFINIDO)?$/i.test(label(e)));
    if(provider&&allowSignIn){provider.click();return {stage:'navigating'}};
    const request=list.find(e=>/^(Petición|Petició|Solicitud|Solicitar|Request)$/i.test(label(e)));
    if(request&&!clicked){request.click();clicked=true;}
    else if(!clicked&&!signin){const login=list.find(e=>/^(Identificarse|Identificar-se|Sign in)$/i.test(label(e)));if(login){if(!allowSignIn)return {stage:'login'};login.click();signin=true;}}
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  return {stage:signin?'login':clicked?'calendar_missing':'page_changed'};
}
