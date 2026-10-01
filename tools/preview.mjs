import {spawn} from 'node:child_process';
import {openSync,closeSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const mode=process.argv.includes('--dev')?'dev':'preview';
try{const r=await fetch('http://127.0.0.1:4180/',{signal:AbortSignal.timeout(800)});if(r.ok){console.log('Port 4180 already serves a page. Existing process preserved.');process.exit(0);}}catch{}
mkdirSync(resolve(root,'.preview'),{recursive:true});const log=openSync(resolve(root,'.preview/server.log'),'a');
const args=[resolve(root,'node_modules/vite/bin/vite.js'),...(mode==='preview'?['preview']:[]),'--host','127.0.0.1','--port','4180','--strictPort'];
const child=spawn(process.execPath,args,{cwd:root,detached:true,windowsHide:true,stdio:['ignore',log,log]});closeSync(log);child.unref();console.log(JSON.stringify({pid:child.pid,url:'http://127.0.0.1:4180/',mode}));
