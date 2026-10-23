// Run browser and core checks serially so they do not disturb animation timing.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve('設計検証/終了待機-20261024'),pw='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const jobs=[
  ['mirror-webkit',['設計検証/check_mirror_wheel.cjs','--playwright-path',pw,'--engine','webkit']],
  ['edges-chromium',['設計検証/check_ending_edges.cjs','--playwright-path',pw,'--engine','chromium']],
  ['edges-webkit',['設計検証/check_ending_edges.cjs','--playwright-path',pw,'--engine','webkit']],
  ['tests',['scripts/run-tests.js']],
  ['syntax',['scripts/check-source.js']],
  ...['check_play_pacing','check_ending_edges','summarize_ending_checks','check_mirror_wheel','browser_wait'].map(name=>['syntax-'+name,['--check','設計検証/'+name+'.cjs']]),
  ['build',['scripts/build.js']],
  ['summary',['設計検証/summarize_ending_checks.cjs']],
];
const result={passed:false,jobs:[]};fs.mkdirSync(root,{recursive:true});
for(const [name,args] of jobs){
  result.current=name;fs.writeFileSync(path.join(root,'followups.json'),JSON.stringify(result,null,2));console.log('Running '+name);
  const file=path.join(root,name+'.log'),fd=fs.openSync(file,'w'),r=cp.spawnSync(process.execPath,args,{stdio:['ignore',fd,fd],windowsHide:true});fs.closeSync(fd);
  result.jobs.push({name,code:r.status,error:r.error?.message,log:file});
  fs.writeFileSync(path.join(root,'followups.json'),JSON.stringify(result,null,2));
  if(r.status!==0){console.error(fs.readFileSync(file,'utf8').slice(-6000));process.exit(r.status||1);}console.log(name+' passed');
}
result.passed=true;fs.writeFileSync(path.join(root,'followups.json'),JSON.stringify(result,null,2));
