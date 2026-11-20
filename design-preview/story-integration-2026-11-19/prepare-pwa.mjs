import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),base=path.resolve('design-preview/story-integration-2026-11-19/pwa'),oldRoot=path.join(base,'old-0.103.0'),sha='71c734b71e49f48e35a9af18f8497a1997b4fbee';
if(!base.startsWith(root+path.sep)||path.dirname(oldRoot)!==base)throw Error('Unexpected fixture target');
fs.mkdirSync(base,{recursive:true});
if(!fs.existsSync(oldRoot)){
 fs.mkdirSync(oldRoot);const tar=path.join(base,'released-0.103.0.tar');
 execFileSync('git',['archive','--format=tar','--output='+tar,sha,'package.json','index.html','src','public','画面案/ロゴ/fonts','scripts/build.js'],{windowsHide:true});
 execFileSync('python',['-c','import tarfile,sys; tarfile.open(sys.argv[1],encoding="utf-8").extractall(sys.argv[2],filter="data")',tar,oldRoot],{windowsHide:true});
}
if(!fs.existsSync(path.join(oldRoot,'画面案/ロゴ/fonts/montserrat-500.ttf'))){
 execFileSync('python',['-c','import tarfile,sys; tarfile.open(sys.argv[1],encoding="utf-8").extractall(sys.argv[2],filter="data")',path.join(base,'released-0.103.0.tar'),oldRoot],{windowsHide:true});
}
if(JSON.parse(fs.readFileSync(path.join(oldRoot,'package.json'),'utf8')).version!=='0.103.0')throw Error('Wrong old release');
// Each canonical builder removes only its own verified generated dist directory.
for(const cwd of [oldRoot,root]){
 const target=path.resolve(cwd,'dist');if(path.dirname(target)!==cwd)throw Error('Unexpected dist target');
 console.log(execFileSync(process.execPath,['scripts/build.js'],{cwd,env:{...process.env,...(cwd===oldRoot?{GITHUB_SHA:sha}:{})},windowsHide:true}).toString().trim());
}
console.log(JSON.stringify({old:path.join(oldRoot,'dist'),current:path.join(root,'dist')}));
