// Serial, bounded child processes: never run large browser matrices together.
const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const runtime='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const root=path.resolve(__dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version,out=path.join(__dirname,'三つのテーマ',version,'matrix');fs.mkdirSync(out,{recursive:true});
const suite=process.argv[2]||'main';
const jobs=suite==='main'?[
 ['extension-webkit','check_extension_sets.cjs','--engine','webkit'],
 ['extension-chromium','check_extension_sets.cjs','--engine','chromium'],
 ['extension-chrome','check_extension_sets.cjs','--channel','chrome'],
 ['extension-msedge','check_extension_sets.cjs','--channel','msedge'],
]:suite==='offline'?['chromium','webkit'].map(engine=>['offline-'+engine,'check_extension_sets.cjs','--engine',engine,'--offline','--from-stage','25','--stages','25,31,37,42']):[
 ...['chromium','webkit'].flatMap(engine=>[
  ['condition-'+engine,'check_condition_card.cjs','--engine',engine,'--all-stages'],
  ['delete-'+engine,'check_delete_button.cjs','--engine',engine],
  ['pager-'+engine,'check_challenge_pager_touch.cjs','--engine',engine],
  ['directions-'+engine,'check_edge_directions.cjs','--engine',engine],
 ])
];
const report={suite,passed:false,jobs:[]};
const reportPath=path.join(out,suite+'.json'),builtAt=fs.statSync(path.join(root,'dist','build-info.json')).mtimeMs;
const previous=process.argv.includes('--resume')&&fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)):null;
for(const [name,file,...args]of jobs){
 const completed=previous?.jobs.find(job=>job.name===name&&job.code===0);
 if(completed&&fs.existsSync(completed.log)&&fs.statSync(completed.log).mtimeMs>=builtAt){report.jobs.push({...completed,reused:true});console.log('Kept verified '+name);continue;}
 console.log('Starting '+name);const log=path.join(out,name+'.log'),fd=fs.openSync(log,'w');
 const r=spawnSync(process.execPath,[path.join(__dirname,file),'--playwright-path',runtime,...args],{cwd:root,stdio:['ignore',fd,fd],windowsHide:true,timeout:900000});fs.closeSync(fd);
 report.jobs.push({name,code:r.status,error:r.error?.message,log:path.relative(root,log)});fs.writeFileSync(path.join(out,suite+'.json'),JSON.stringify(report,null,2));
 if(r.status!==0){console.error(name+' failed: '+fs.readFileSync(log,'utf8').slice(-2500));process.exit(1);}console.log('Passed '+name);
}
report.passed=true;fs.writeFileSync(path.join(out,suite+'.json'),JSON.stringify(report,null,2));console.log('All '+jobs.length+' '+suite+' browser jobs passed.');
