const {app,BrowserWindow,ipcMain,session,shell,Menu}=require('electron');
const http=require('node:http');const path=require('node:path');const fs=require('node:fs');
const {allowedUjiNavigation,allowedCatalogue,localRequestURL,trustedLocalURL,validDay,normalized}=require('./policy.cjs');
const {ConnectionController}=require('./connection.cjs');
if(!app.requestSingleInstanceLock())app.exit(0);
const root=path.resolve(__dirname,'..'),rooms=JSON.parse(fs.readFileSync(path.join(root,'ui/rooms.json'))),known=rooms.filter(r=>r.bookingSupported);
const navigate=fs.readFileSync(path.join(__dirname,'navigate.js'),'utf8'),reader=fs.readFileSync(path.join(__dirname,'reader.js'),'utf8');
const RECORD='https://cataleg.uji.es/discovery/fulldisplay?docid=alma991004555715806336&context=L&vid=34CVA_UJI%3AVU1&lang=es';
let main,consultation,booking,server,localOrigin,controller,shuttingDown=false;
app.on('second-instance',()=>{if(main&&!main.isDestroyed()){main.show();main.focus();}});
function officialWindow(title){
 const win=new BrowserWindow({width:1100,height:800,show:false,title,autoHideMenuBar:true,webPreferences:{partition:'persist:uji-local',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 win.webContents.on('will-navigate',(event,url)=>{if(!allowedUjiNavigation(url))event.preventDefault();});
 win.webContents.on('will-redirect',(event,url)=>{if(!allowedUjiNavigation(url))event.preventDefault();});
 win.webContents.setWindowOpenHandler(({url})=>{if(allowedUjiNavigation(url)){win.loadURL(url).catch(()=>{});win.show();}return {action:'deny'};});
 win.webContents.on('page-title-updated',event=>event.preventDefault());
 win.webContents.on('did-navigate',(_event,url)=>{try{win.setTitle('UJI · '+new URL(url).hostname);}catch{}});
 return win;
}
function emit(message){if(!main||main.isDestroyed())return;main.webContents.send('cabinas:result',{channel:'cabinas-uji-extension',...message});}
function createController(official){
 let signInAttempted=false;
 return new ConnectionController({rooms:known,emit,adapter:{
  async prepare(){
   signInAttempted=false;
   if(!consultation||consultation.isDestroyed()){
    const window=officialWindow('UJI · Inicio de sesión y consulta');consultation=window;
    window.on('closed',()=>{if(consultation===window)consultation=null;});
   }
   await consultation.loadURL(RECORD);
  },
  async advance(){
   if(!consultation||consultation.isDestroyed())return 'closed';
   if(consultation.webContents.isLoadingMainFrame())return 'loading';
   const u=new URL(consultation.webContents.getURL());
   if(u.origin!=='https://cataleg.uji.es')return 'login';
   if(['/view/uresolver/34CVA_UJI/bookingAvailability','/view/calendar/Calendar.html'].includes(u.pathname))return 'ready';
   if(!u.pathname.startsWith('/discovery/'))return 'page_changed';
   try{const result=await consultation.webContents.executeJavaScript(navigate+'\nadvanceUjiCalendar('+(!signInAttempted)+')',true);if(result?.stage==='navigating')signInAttempted=true;return result?.stage||'page_changed';}
   catch{if(consultation&&!consultation.isDestroyed()&&(consultation.webContents.isLoadingMainFrame()||!consultation.webContents.getURL().startsWith('https://cataleg.uji.es/')))return 'loading';throw Error('navigation_failed');}
  },
  async read(date,id){
   if(!consultation||consultation.isDestroyed())return {ok:false,code:'open_calendar'};
   return consultation.webContents.executeJavaScript(reader+'\nreadUjiCalendar('+JSON.stringify(date)+','+JSON.stringify(known)+','+id+')',true);
  },
  async reveal(){if(consultation&&!consultation.isDestroyed())consultation.show();},
  async hide(){if(consultation&&!consultation.isDestroyed())consultation.hide();if(main&&!main.isDestroyed()){main.show();main.focus();}},
  async close(){for(const window of [consultation,booking])if(window&&!window.isDestroyed())window.destroy();consultation=null;booking=null;},
  async clearSession(){await official.clearStorageData();await Promise.all([official.clearAuthCache(),official.clearCache()]);}
 }});
}
function openCatalogue(url){
 if(!allowedCatalogue(url,rooms))return;
 if(!booking||booking.isDestroyed())booking=officialWindow('UJI · Confirma tu reserva en el formulario oficial');
 booking.loadURL(url).then(()=>booking.show()).catch(()=>{});
}
function external(url){try{const u=new URL(url);if(u.protocol==='https:'&&!u.username&&!u.password&&['www.google.com','maps.google.com','www.uji.es','sites.google.com'].includes(u.hostname))shell.openExternal(u.href);}catch{}}
ipcMain.on('cabinas:command',(event,m)=>{
 if(event.sender!==main?.webContents||event.senderFrame!==main.webContents.mainFrame||!trustedLocalURL(event.senderFrame.url,localOrigin))return;
 if(!controller||controller.resetting)return;
 if(m?.type==='ping'){event.sender.send('cabinas:result',{channel:'cabinas-uji-extension',type:'ready',version:2});return;}
 if(m?.type==='disconnect'){
  main.webContents.send('cabinas:reset',{phase:'started'});
  controller.reset().then(ok=>{if(main&&!main.isDestroyed()){main.webContents.send('cabinas:reset',{phase:ok?'complete':'failed'});if(ok)main.webContents.reload();}});return;
 }
 if(!m||!/^[-a-zA-Z0-9]{8,80}$/.test(m.requestId||''))return;
 if(m.type==='cancel'){controller.cancel(m.requestId);return;}
 if(m.type!=='connect'||!validDay(m.date))return;
 controller.start(m);
});
app.whenReady().then(async()=>{
 Menu.setApplicationMenu(null);
 const official=session.fromPartition('persist:uji-local');official.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));official.setPermissionCheckHandler(()=>false);
 official.on('will-download',event=>event.preventDefault());
 controller=createController(official);
 server=http.createServer((req,res)=>{
  if(req.headers.host!==new URL(localOrigin).host){res.writeHead(403);res.end();return;}
  const url=localRequestURL(req.url,localOrigin);
  if(!url){res.writeHead(400);res.end();return;}
  const p=url.pathname;let body,type;
  if(p==='/'){body=fs.readFileSync(path.join(root,'ui/index.html'));type='text/html; charset=utf-8';}
  else if(p==='/app.js'){body=fs.readFileSync(path.join(root,'ui/app.js'));type='application/javascript; charset=utf-8';}
  else if(p==='/api/rooms'){body=JSON.stringify(rooms);type='application/json';}
  else if(p==='/api/availability'){const ids=(url.searchParams.get('ids')||'').split(',',4).map(Number);body=JSON.stringify({rooms:ids.map(id=>({id,error:true,reason:'access_required',events:[]}))});type='application/json';}
  else{res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.uji.es https://documents.uji.es; frame-src https://maps.google.com https://www.google.com https://cataleg.uji.es; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});res.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));localOrigin='http://127.0.0.1:'+server.address().port;
 main=new BrowserWindow({width:1450,height:960,minWidth:920,minHeight:680,title:'Cabinas UJI',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 main.webContents.on('will-navigate',(event,url)=>{if(url!==localOrigin+'/')event.preventDefault();});
 main.webContents.setWindowOpenHandler(({url})=>{if(allowedCatalogue(url,rooms))openCatalogue(url);else external(url);return {action:'deny'};});
 main.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 await main.loadURL(localOrigin+'/');
 main.on('closed',()=>{controller.cancel();for(const w of BrowserWindow.getAllWindows())w.destroy();server.close();app.quit();});
});
app.on('window-all-closed',()=>{if(!shuttingDown){shuttingDown=true;server?.close();app.quit();}});
