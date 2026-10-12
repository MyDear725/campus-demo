import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const url='http://127.0.0.1:4173';
async function ready(){try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});return r.ok&&(await r.text()).includes('CAMPUS ECHO');}catch{return false;}}
if(!await ready()){
  const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,detached:true,stdio:'ignore',windowsHide:true});
  child.on('error',e=>{console.error('启动失败：'+e.message);process.exitCode=1;});child.unref();
  for(let i=0;i<40&&!await ready();i++)await new Promise(resolve=>setTimeout(resolve,200));
}
if(await ready()){
  execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',"Start-Process 'http://127.0.0.1:4173'"],{windowsHide:true},error=>{if(error){console.error('请手动打开：'+url);process.exitCode=1;}});
  console.log('校园 Demo 已启动：'+url);
}else{console.error('无法启动 Demo，可能是 4173 端口已被其他程序占用。');process.exitCode=1;}
