import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),base=path.resolve('design-preview/story-wait-2026-11-20'),oldRoot=path.join(base,'pwa/old-0.104.0'),sha='24a82dc53acbeddc162896f729eaa39de3169d71';
if(!oldRoot.startsWith(root+path.sep))throw Error('Unexpected fixture target');
fs.mkdirSync(oldRoot,{recursive:true});
const files=execFileSync('git',['ls-tree','-r','--name-only','-z',sha,'--','index.html','package.json','src','public','画面案/ロゴ/fonts','scripts/build.js']).toString('utf8').split('\0').filter(Boolean);
for(const file of files){const output=path.resolve(oldRoot,file);if(!output.startsWith(oldRoot+path.sep))throw Error('Unexpected blob path');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,execFileSync('git',['cat-file','blob',sha+':'+file],{maxBuffer:20*1024*1024,windowsHide:true}));}
for(const cwd of [oldRoot,root]){const target=path.resolve(cwd,'dist');if(path.dirname(target)!==cwd)throw Error('Unexpected generated target');console.log(execFileSync(process.execPath,['scripts/build.js'],{cwd,env:{...process.env,...(cwd===oldRoot?{GITHUB_SHA:sha}:{})},windowsHide:true}).toString().trim());}
console.log('Prepared authentic 0.104.0 to 0.105.0 update verification');
