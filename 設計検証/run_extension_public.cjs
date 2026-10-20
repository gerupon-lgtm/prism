const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'三つのテーマ',version,'matrix');fs.mkdirSync(out,{recursive:true});
const commit=process.argv[2];if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Pass the deployed source commit');
const playwright='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const report={commit,passed:false,jobs:[]};
for(const url of ['https://prism.sikumilab.com/','https://gerupon-lgtm.github.io/prism/']){
 const host=new URL(url).hostname;
 for(const [name,args]of [
  ['assets',['check_public.cjs','--url',url,'--commit',commit,'--out-dir',path.join(__dirname,'三つのテーマ',version,host,'public')]],
  ['play',['check_extension_sets.cjs','--url',url,'--engine','chromium']],
  ['mirrors',['check_mirror_optics.cjs','--url',url,'--engine','chromium']],
 ]){
  const label=host+'-'+name;console.log('Starting '+label);const fd=fs.openSync(path.join(out,label+'.log'),'w');
  const result=spawnSync(process.execPath,[path.join(__dirname,args[0]),...args.slice(1),'--playwright-path',playwright],{cwd:root,stdio:['ignore',fd,fd],windowsHide:true,timeout:900000});fs.closeSync(fd);
  report.jobs.push({label,code:result.status,error:result.error?.message});fs.writeFileSync(path.join(out,'public.json'),JSON.stringify(report,null,2));
  if(result.status!==0){console.error(fs.readFileSync(path.join(out,label+'.log'),'utf8').slice(-3000));process.exit(1);}console.log('Passed '+label);
 }
}
report.passed=true;fs.writeFileSync(path.join(out,'public.json'),JSON.stringify(report,null,2));console.log('All public deployment and gameplay checks passed.');
