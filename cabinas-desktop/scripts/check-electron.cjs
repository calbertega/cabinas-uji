const {app,BrowserWindow,ipcMain,session}=require('electron');
const http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
// Real Chromium/Electron integration, with synthetic cookies in nonpersistent
// partitions. No UJI request, real profile or account is read or cleared.
app.setPath('userData',path.resolve(__dirname,'../.test-runtime',randomUUID()));
app.disableHardwareAcceleration();
app.on('window-all-closed',()=>{});
let server,window,checks=0;
function check(value,label){assert.ok(value,label);checks++;}
app.whenReady().then(async()=>{try{
 const first=session.fromPartition('test-'+randomUUID()),other=session.fromPartition('test-'+randomUUID());
 const cookie={url:'https://cataleg.uji.es/',name:'__cabinas_test',value:'synthetic-only',secure:true};
 await first.cookies.set(cookie);await other.cookies.set(cookie);
 check((await first.cookies.get({name:cookie.name})).length===1,'Fixture session created');
 await first.clearStorageData();await Promise.all([first.clearAuthCache(),first.clearCache()]);
 check((await first.cookies.get({name:cookie.name})).length===0,'Native session reset removes its own cookies');
 check((await other.cookies.get({name:cookie.name})).length===1,'Reset leaves other partitions unchanged');
 server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Cabinas test fixture</title>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 window=new BrowserWindow({show:false,webPreferences:{partition:'test-'+randomUUID(),preload:path.resolve(__dirname,'../desktop/preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 await window.loadURL(url);
 check(await window.webContents.executeJavaScript("typeof window.require==='undefined'&&typeof window.process==='undefined'"),'Renderer cannot access Node');
 check(await window.webContents.executeJavaScript("typeof window.cabinasDesktop.send==='function'&&Object.keys(window.cabinasDesktop).length===2"),'Only the intended native bridge is exposed');
 const received=new Promise(resolve=>ipcMain.once('cabinas:command',(_event,value)=>resolve(value)));
 await window.webContents.executeJavaScript("window.cabinasDesktop.send({type:'connect',requestId:'test-only-request',date:'2026-11-02',privateFixture:'must-not-cross'});true");
 const command=await received;check(command.type==='connect'&&!('privateFixture'in command),'Preload strips extra fields');
 await window.webContents.executeJavaScript("window.__received=null;window.cabinasDesktop.onMessage(m=>window.__received=m);true");
 window.webContents.send('cabinas:reset',{phase:'complete'});
 for(let i=0;i<50;i++){if(await window.webContents.executeJavaScript("window.__received?.phase==='complete'"))break;await new Promise(r=>setTimeout(r,20));}
 check(await window.webContents.executeJavaScript("window.__received?.type==='session_reset'&&window.__received.phase==='complete'"),'Native reset notification reaches isolated UI');
 window.destroy();window=new BrowserWindow({show:false,webPreferences:{partition:'test-'+randomUUID(),nodeIntegration:false,contextIsolation:true,sandbox:true}});await window.loadURL(url);
 check(await window.webContents.executeJavaScript("typeof window.cabinasDesktop==='undefined'&&typeof window.require==='undefined'"),'Official-window configuration has no local bridge or Node');
 console.log(JSON.stringify({passed:true,checks,scope:'native-electron-session-and-preload-with-synthetic-data',liveUjiTest:false}));
 window.destroy();server.close();app.quit();
 }catch(error){console.error('Integration failed after '+checks+' checks: '+error.message);window?.destroy();server?.close();app.exit(1);}});
