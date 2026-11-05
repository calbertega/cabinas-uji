import {readFile,writeFile,mkdir,readdir,link,copyFile,stat} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.platform!=='win32')throw Error('This build packages Windows x64; run on Windows.');
const pkg=JSON.parse(await readFile(path.join(root,'package.json')));const release=path.join(root,'release'),dest=path.join(release,'Cabinas-UJI-'+pkg.version+'-windows-x64');
await mkdir(dest,{recursive:true});
async function runtimeTree(from,to){await mkdir(to,{recursive:true});for(const e of await readdir(from,{withFileTypes:true})){const a=path.join(from,e.name),b=path.join(to,e.name==='electron.exe'?'Cabinas UJI.exe':e.name);if(e.isDirectory())await runtimeTree(a,b);else{try{await stat(b);}catch{try{await link(a,b);}catch{await copyFile(a,b);}}}}}
async function copyTree(from,to){await mkdir(to,{recursive:true});for(const e of await readdir(from,{withFileTypes:true})){const a=path.join(from,e.name),b=path.join(to,e.name);if(e.isDirectory())await copyTree(a,b);else await copyFile(a,b);}}
await runtimeTree(path.join(root,'node_modules/electron/dist'),dest);
const appdir=path.join(dest,'resources/app');await mkdir(appdir,{recursive:true});
for(const d of ['desktop','ui'])await copyTree(path.join(root,d),path.join(appdir,d));
await writeFile(path.join(appdir,'package.json'),JSON.stringify({name:pkg.name,productName:pkg.productName,version:pkg.version,main:pkg.main}));
await copyFile(path.join(root,'LEEME.txt'),path.join(dest,'LEEME.txt'));
await copyFile(path.join(root,'../LICENSE'),path.join(dest,'LICENSE-Cabinas-UJI.txt'));
const archive=dest+'.zip';
// Literal environment paths avoid shell interpolation and quoting hazards.
const result=spawnSync('powershell.exe',['-NoProfile','-Command','Compress-Archive -LiteralPath $env:CABINAS_PACKAGE_DIRECTORY -DestinationPath $env:CABINAS_PACKAGE_ARCHIVE -CompressionLevel Optimal -Force'],{env:{...process.env,CABINAS_PACKAGE_DIRECTORY:dest,CABINAS_PACKAGE_ARCHIVE:archive},encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr||'Packaging failed');
const sha=createHash('sha256').update(await readFile(archive)).digest('hex');await writeFile(archive+'.sha256',sha+'  '+path.basename(archive)+'\n');
console.log(JSON.stringify({directory:dest,archive,sha256:sha}));
