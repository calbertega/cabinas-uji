const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cabinasDesktop',Object.freeze({
  send(message){if(message&&['ping','connect','cancel','disconnect'].includes(message.type))ipcRenderer.send('cabinas:command',{type:message.type,requestId:message.requestId,date:message.date});},
  onMessage(callback){if(typeof callback!=='function')return;ipcRenderer.on('cabinas:result',(_event,message)=>callback(message));ipcRenderer.on('cabinas:reset',(_event,message)=>callback({type:'session_reset',phase:message.phase}));}
}));
