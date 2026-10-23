const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve('設計検証/終了待機-20261024/public'),pw='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',commit='cec2d595e5b01f5ddf66e8af5c4a522cbc30b7d5';
fs.mkdirSync(root,{recursive:true});
const jobs=[
  ...['https://prism.sikumilab.com/','https://gerupon-lgtm.github.io/prism/'].map(url=>[new URL(url).hostname,['設計検証/check_public.cjs','--url',url,'--commit',commit,'--playwright-path',pw,'--out-dir',path.join(root,new URL(url).hostname)]]),
  ['pacing',['設計検証/check_play_pacing.cjs','--url','https://prism.sikumilab.com/','--draw','5','--stages','25,32','--only-winner','--playwright-path',pw,'--out',path.join(root,'pacing')]],
  ['wheel',['設計検証/check_mirror_wheel.cjs','--url','https://prism.sikumilab.com/','--engine','chromium','--playwright-path',pw]],
];
const report={version:'0.90.0',commit,passed:false,jobs:[]};
for(const [name,args]of jobs){
  report.current=name;fs.writeFileSync(path.join(root,'jobs.json'),JSON.stringify(report,null,2));console.log('Public '+name);
  const log=path.join(root,name+'.log'),fd=fs.openSync(log,'w'),result=cp.spawnSync(process.execPath,args,{stdio:['ignore',fd,fd],windowsHide:true});fs.closeSync(fd);
  report.jobs.push({name,code:result.status,log});fs.writeFileSync(path.join(root,'jobs.json'),JSON.stringify(report,null,2));
  if(result.status!==0){console.error(fs.readFileSync(log,'utf8').slice(-6000));process.exit(result.status||1);}console.log(name+' passed');
}
report.passed=true;fs.writeFileSync(path.join(root,'jobs.json'),JSON.stringify(report,null,2));
