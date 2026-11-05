import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile,readdir,access} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const smoke=process.argv.includes('--smoke-tests');
const sandbox=process.argv.includes('--sandbox');
const manifestSource=await readFile(join(root,'app/src/main/AndroidManifest.xml'),'utf8');
const version=manifestSource.match(/android:versionName="([0-9.]+)"/)?.[1];if(!version)throw Error('Manifest version missing');
const sdk=process.env.ANDROID_HOME||resolve(root,'../android-tools/sdk');
const jdk=process.env.JAVA_HOME;
if(!jdk)throw Error('Define JAVA_HOME apuntando a un JDK 17 o posterior.');
const win=process.platform==='win32',tool=n=>join(jdk,'bin',n+(win?'.exe':''));
const build=join(root,'build',(smoke?'smoke':'app')+(sandbox?'-sandbox':'')),classes=join(build,'classes'),dex=join(build,'dex'),release=join(root,'release');
const platform=join(sdk,'platforms/android-35/android.jar'),bt=join(sdk,'build-tools/35.0.0');
const signer=resolve(process.env.CABINAS_SIGNING_DIR||join(root,'.private'));
const key=join(signer,'android-release.p12'),passwordFile=join(signer,'android-release.password');
for(const dir of [classes,dex,release,signer])await mkdir(dir,{recursive:true});
function run(exe,args,env=process.env){const r=spawnSync(exe,args,{cwd:root,env,encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(`${exe}: ${r.error?.message||r.stderr||r.stdout}`);if(r.stderr?.trim())process.stderr.write(r.stderr);return r.stdout;}
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
if(await exists(key)!==await exists(passwordFile))throw Error('La clave de firma y su contraseña deben conservarse juntas. No se regenerará una identidad existente.');
let password;
if(!await exists(key)){
 password=randomBytes(32).toString('base64url');
 run(tool('keytool'),['-genkeypair','-keystore',key,'-storetype','PKCS12','-alias','cabinas-uji','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Cabinas UJI independiente','-storepass:env','CABINAS_KEY_PASSWORD','-keypass:env','CABINAS_KEY_PASSWORD'],{...process.env,CABINAS_KEY_PASSWORD:password});
 await writeFile(passwordFile,password,{mode:0o600});
}else password=await readFile(passwordFile,'utf8');
run(process.execPath,['scripts/prepare-ui.mjs']);
const java=join(root,smoke?'app/src/smoke/java/es/cabinasuji/independiente/smoke/SmokeRunner.java':'app/src/main/java/es/cabinasuji/independiente/MainActivity.java');
run(tool('javac'),['--release','8','-encoding','UTF-8','-cp',platform,'-d',classes,java]);
async function all(dir,suffix){let out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await all(p,suffix));else if(p.endsWith(suffix))out.push(p);}return out;}
run(tool('java'),['-cp',join(bt,'lib/d8.jar'),'com.android.tools.r8.D8','--lib',platform,'--min-api','26','--output',dex,...await all(classes,'.class')]);
const unsigned=join(build,'unsigned.apk'),aligned=join(build,'aligned.apk'),apk=join(release,smoke?`Cabinas-UJI-android-smoke-tests${sandbox?'-sandbox':''}.apk`:`Cabinas-UJI-${version}-android${sandbox?'-sandbox':''}.apk`);
let manifestPath=join(root,smoke?'app/src/smoke/AndroidManifest.xml':'app/src/main/AndroidManifest.xml');
if(sandbox){let manifest=await readFile(manifestPath,'utf8');manifest=smoke?manifest.replace('package="es.cabinasuji.independiente.smoke"','package="es.cabinasuji.independiente.smoke.sandbox"').replace('android:name=".SmokeRunner"','android:name="es.cabinasuji.independiente.smoke.SmokeRunner"').replace('android:targetPackage="es.cabinasuji.independiente"','android:targetPackage="es.cabinasuji.independiente.sandbox"'):manifest.replace('package="es.cabinasuji.independiente"','package="es.cabinasuji.independiente.sandbox"').replace('android:name=".MainActivity"','android:name="es.cabinasuji.independiente.MainActivity"').replace('android:label="Cabinas UJI"','android:label="Cabinas UJI pruebas aisladas"');manifestPath=join(build,'AndroidManifest.xml');await writeFile(manifestPath,manifest);}
const resources=join(build,'resources.zip');
run(join(bt,'aapt2'+(win?'.exe':'')),['compile','--dir',join(root,'app/src/main/res'),'-o',resources]);
run(join(bt,'aapt2'+(win?'.exe':'')),['link',...(smoke?[]:[resources]),'--manifest',manifestPath,'-I',platform,...(smoke?[]:['-A',join(root,'app/src/main/assets')]),'-o',unsigned,'--min-sdk-version','26','--target-sdk-version','35']);
run(tool('jar'),['uf',unsigned,...(await all(dex,'.dex')).flatMap(p=>['-C',dex,p.slice(dex.length+1)])]);
run(join(bt,'zipalign'+(win?'.exe':'')),['-f','4',unsigned,aligned]);
const signArgs=['-jar',join(bt,'lib/apksigner.jar')];
run(tool('java'),[...signArgs,'sign','--ks',key,'--ks-key-alias','cabinas-uji','--ks-pass','env:CABINAS_KEY_PASSWORD','--key-pass','env:CABINAS_KEY_PASSWORD','--out',apk,aligned],{...process.env,CABINAS_KEY_PASSWORD:password});
const verification=run(tool('java'),[...signArgs,'verify','--verbose','--print-certs',apk]);
const manifest=run(join(bt,'aapt2'+(win?'.exe':'')),['dump','badging',apk]);
const sha256=createHash('sha256').update(await readFile(apk)).digest('hex');
await writeFile(apk+'.sha256',`${sha256}  ${apk.slice(release.length+1)}\n`);
await writeFile(join(release,(sandbox?'sandbox-':'')+(smoke?'smoke-verification.txt':'verification.txt')),verification+'\n'+manifest+'\nSHA-256: '+sha256+'\n');
console.log(JSON.stringify({apk,sha256,signatureVerified:true,realAndroidTested:false}));
